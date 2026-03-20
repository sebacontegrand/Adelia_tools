/**
 * Structured extraction module using Gemini LLM.
 * Extracts advertising metadata (brand, product, format, etc.) from OCR text + image.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

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

/**
 * Extract structured ad metadata from OCR text and the original image.
 */
export async function extractAdMetadata(
  ocrText: string,
  imageBuffer: Buffer,
  context: { source: string; section?: string; width: number; height: number }
): Promise<AdExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imageBase64 = imageBuffer.toString("base64");

  const prompt = `You are an expert advertising analyst specializing in Argentinian media.
Analyze this advertisement image along with its OCR text. The ad was found on ${context.source}${context.section ? ` in the "${context.section}" section` : ""}.
The image dimensions are ${context.width}x${context.height} pixels.

OCR Text extracted from the ad:
"""
${ocrText}
"""

Extract the following information:
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

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "image/png",
        data: imageBase64,
      },
    },
    { text: prompt },
  ]);

  const response = result.response.text();

  try {
    const cleaned = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    return {
      brand: parsed.brand || "Unknown",
      product: parsed.product || "Unknown",
      campaignName: parsed.campaignName || "",
      adFormat: parsed.adFormat || classifyAdFormat(context.width, context.height),
      cta: parsed.cta || null,
      price: parsed.price || null,
      url: parsed.url || null,
      phone: parsed.phone || null,
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    console.error("[Extract] Failed to parse Gemini response:", response.substring(0, 200));
    return {
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
    };
  }
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
