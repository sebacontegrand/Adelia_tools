/**
 * OCR module using Google Cloud Vision API.
 * Extracts text from ad images with confidence scoring.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
}

/**
 * Perform OCR on an ad image using Gemini Vision (more accessible than Cloud Vision API).
 * This approach uses Gemini's multimodal capabilities for OCR + initial entity extraction.
 */
export async function performOcr(imageBuffer: Buffer): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imageBase64 = imageBuffer.toString("base64");

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "image/png",
        data: imageBase64,
      },
    },
    {
      text: `Extract ALL text visible in this advertisement image. 
Return the text exactly as it appears, preserving line breaks. 
If text is in Spanish, keep it in Spanish.
Include brand names, slogans, URLs, phone numbers, prices, and any other visible text.
Also estimate your confidence that this is indeed an advertisement (0.0 to 1.0).
Return your response in this exact JSON format:
{
  "text": "extracted text here",
  "confidence": 0.85,
  "language": "es"
}
Return ONLY the JSON, no markdown formatting.`,
    },
  ]);

  const response = result.response.text();

  try {
    const cleaned = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      text: parsed.text || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      language: parsed.language || "es",
    };
  } catch {
    // If JSON parsing fails, treat the whole response as OCR text
    return {
      text: response,
      confidence: 0.5,
      language: "es",
    };
  }
}
