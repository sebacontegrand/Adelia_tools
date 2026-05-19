/**
 * Structured extraction module using Gemini LLM.
 * Extracts advertising metadata (brand, product, format, etc.) from OCR text + image.
 */

import { geminiGenerateText } from "@/lib/ai/gemini";
import type { OcrResult } from "./ocr";

export interface AdExtraction {
  brand: string;
  product: string;
  campaignName: string;
  adFormat: string;
  cta: string | null;     // Call to action
  price: string | null;
  url: string | null;
  phone: string | null;
  entities: { type: string; value: string; confidence: number }[];
  confidence: number;
}

export interface AdImageAnalysis {
  ocr: OcrResult;
  extraction: AdExtraction;
}

function safeJsonParse(text: string) {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned) as unknown;
}

/**
 * Single-shot analysis: OCR + structured extraction from the ad image.
 * This avoids two separate Gemini calls per ad region.
 */
export async function analyzeAdImage(
  imageBuffer: Buffer,
  context: { source: string; section?: string; width: number; height: number }
): Promise<AdImageAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const imageBase64 = imageBuffer.toString("base64");

  const prompt = `You are an expert advertising analyst specializing in Argentinian media.
Analyze this advertisement image. The ad was found on ${context.source}${context.section ? ` in the "${context.section}" section` : ""}.
The image dimensions are ${context.width}x${context.height} pixels.

First, extract ALL visible text from the image (preserve line breaks) and provide an OCR confidence (0.0-1.0).
Then extract the following structured information:
1. **Brand**: The company or brand advertising (e.g., "Coca-Cola", "Personal", "YPF")
2. **Product**: What specific product or service is being advertised
3. **Campaign Name**: The campaign or promotion name if visible (e.g., "Cyber Monday", "Sale de Temporada")
4. **Ad Format**: Classify the ad format based on its dimensions:
   - Leaderboard (728x90 or similar wide banner)
   - Medium Rectangle (300x250 or similar)
   - Skyscraper (160x600 or similar tall)  
   - Billboard (970x250 or wide)
   - Half Page (300x600 or similar)
   - Large Banner (if it doesn't fit standard sizes)
   - Native Ad (if it blends with content)
   - Interstitial (full-screen overlay)
5. **CTA**: Call to action text (e.g., "Comprá ahora", "Conocé más")
6. **Price**: Any price mentioned
7. **URL**: Any website URL visible
8. **Phone**: Any phone number visible
9. **Entities**: Any additional named entities found (people, events, locations)

Return your response as JSON (no markdown):
{
  "ocrText": "string",
  "ocrConfidence": 0.85,
  "language": "es",
  "brand": "string",
  "product": "string", 
  "campaignName": "string or empty",
  "adFormat": "string",
  "cta": "string or null",
  "price": "string or null",
  "url": "string or null",
  "phone": "string or null",
  "entities": [{"type": "brand|product|event|location|person", "value": "string", "confidence": 0.0-1.0}],
  "confidence": 0.0-1.0
}`;

  const response = await geminiGenerateText({
    apiKey,
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    parts: [
      {
        inlineData: {
          mimeType: "image/png",
          data: imageBase64,
        },
      },
      { text: prompt },
    ],
  });

  try {
    const parsed = safeJsonParse(response) as Record<string, unknown>;

    const extraction: AdExtraction = {
      brand: (parsed.brand as string) || "Unknown",
      product: (parsed.product as string) || "Unknown",
      campaignName: (parsed.campaignName as string) || "",
      adFormat: (parsed.adFormat as string) || classifyAdFormat(context.width, context.height),
      cta: (parsed.cta as string) || null,
      price: (parsed.price as string) || null,
      url: (parsed.url as string) || null,
      phone: (parsed.phone as string) || null,
      entities: Array.isArray(parsed.entities) ? (parsed.entities as AdExtraction["entities"]) : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };

    const ocr: OcrResult = {
      text: typeof parsed.ocrText === "string" ? parsed.ocrText : "",
      confidence: typeof parsed.ocrConfidence === "number" ? parsed.ocrConfidence : extraction.confidence,
      language: typeof parsed.language === "string" ? parsed.language : "es",
    };

    return { ocr, extraction };
  } catch {
    console.error("[Extract] Failed to parse Gemini response:", response.substring(0, 200));
    return {
      ocr: { text: "", confidence: 0.2, language: "es" },
      extraction: {
        brand: "Unknown",
        product: "Unknown",
        campaignName: "",
        adFormat: classifyAdFormat(context.width, context.height),
        cta: null,
        price: null,
        url: null,
        phone: null,
        entities: [],
        confidence: 0.2,
      },
    };
  }
}

/**
 * Back-compat: existing call sites can still pass OCR text.
 * (We ignore OCR text and do a single-shot image analysis.)
 */
export async function extractAdMetadata(
  _ocrText: string,
  imageBuffer: Buffer,
  context: { source: string; section?: string; width: number; height: number }
): Promise<AdExtraction> {
  const analysis = await analyzeAdImage(imageBuffer, context);
  return analysis.extraction;
}

/**
 * Classify ad format based on pixel dimensions, mapping to IAB standard sizes.
 */
export function classifyAdFormat(width: number, height: number): string {
  const ratio = width / height;

  // Check against IAB standard sizes with tolerance
  const standards: { name: string; w: number; h: number }[] = [
    { name: "Leaderboard", w: 728, h: 90 },
    { name: "Medium Rectangle", w: 300, h: 250 },
    { name: "Wide Skyscraper", w: 160, h: 600 },
    { name: "Half Page", w: 300, h: 600 },
    { name: "Billboard", w: 970, h: 250 },
    { name: "Large Leaderboard", w: 970, h: 90 },
    { name: "Mobile Banner", w: 320, h: 50 },
    { name: "Mobile Large Banner", w: 320, h: 100 },
    { name: "Square", w: 250, h: 250 },
  ];

  for (const std of standards) {
    const wRatio = width / std.w;
    const hRatio = height / std.h;
    // Within 30% tolerance
    if (wRatio >= 0.7 && wRatio <= 1.3 && hRatio >= 0.7 && hRatio <= 1.3) {
      return std.name;
    }
  }

  // Fallback classification by aspect ratio
  if (ratio > 4) return "Leaderboard";
  if (ratio > 2) return "Banner";
  if (ratio < 0.5) return "Skyscraper";
  if (ratio >= 0.8 && ratio <= 1.2) return "Square";
  return "Display Ad";
}

/**
 * Normalize dimensions to the nearest IAB standard size label.
 */
export function normalizeSize(width: number, height: number): string {
  return `${width}x${height} (${classifyAdFormat(width, height)})`;
}
