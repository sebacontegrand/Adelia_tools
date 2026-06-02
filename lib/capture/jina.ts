/**
 * Jina Reader API extraction - Fast, low-cost primary method.
 * Respects robots.txt and rate limits. Cost: ~$0.50 per 100 requests.
 */

import { geminiGenerateText, DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";

export interface JinaResult {
  content: string;
  title?: string;
  links?: string[];
  images?: string[];
}

export interface ExtractedAd {
  brand: string;
  product: string;
  cta: string | null;
  landing_domain: string | null;
  format: string;
  confidence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fetchWithJina(url: string): Promise<JinaResult> {
  const jinaApiKey = process.env.JINA_API_KEY;
  const hasValidKey = jinaApiKey && !jinaApiKey.startsWith("your_") && jinaApiKey.length > 10;

  console.log(`[Jina] Fetching ${url}...`);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Return-Format": "markdown",
  };

  if (hasValidKey) {
    headers["Authorization"] = `Bearer ${jinaApiKey}`;
  }

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Jina failed: ${response.status} ${response.statusText}`);
    }

    try {
      const data = await response.json();
      return { content: data.data?.content || data.content || "" };
    } catch {
      // Fallback to plain text
      const text = await response.text();
      return { content: text };
    }
  } catch (error) {
    console.error("[Jina] Fetch error:", error);
    throw error;
  }
}

/**
 * Extract ads from Jina-fetched content using Gemini.
 */
export async function analyzeJinaContent(
  content: string,
  url: string
): Promise<ExtractedAd[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `Analyze this Argentine news website content for advertisements and promotional material.

SOURCE: ${url}

CONTENT (truncated to 12000 chars):
"""
${content.substring(0, 12000)}
"""

For EVERY advertisement, sponsored article, or promotional material found, extract:
1. Brand: Company/brand name (e.g., "Coca-Cola", "Mercedes-Benz", "Personal")
2. Product: What they're selling/promoting (e.g., "Air Max 90 Sneakers", "New A-Class")
3. CTA: Call-to-action text (e.g., "Comprá aquí", "Conocé más", "Descargá la app")
4. Landing Domain: If a domain/URL is visible (e.g., "nike.com", "coca-cola.com.ar", "bensajador.com")
5. Format: image|video|native|text|carousel - based on description

Return ONLY valid JSON array (no markdown, no code blocks, no explanations):
[
  {
    "brand": "string",
    "product": "string",
    "cta": "string or null",
    "landing_domain": "string or null",
    "format": "image",
    "confidence": 0.85
  }
]

CRITICAL: 
- If no ads found, return empty array: []
- Do NOT include non-advertising content (news articles, regular editorials)
- Only include actual marketing/promotional material
- Return ONLY the JSON array, nothing else`;

  try {
    const text = await geminiGenerateText({
      apiKey,
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      parts: prompt,
    });

    // Clean up response
    const cleanJson = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/^[\s\n]*/, "")
      .replace(/[\s\n]*$/, "");

    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed)) {
      console.warn("[Jina] Gemini returned non-array:", typeof parsed);
      return [];
    }

    // Validate and normalize
    return parsed
      .filter((ad) => isRecord(ad) && ad.brand && ad.product)
      .map((ad) => {
        const format = isRecord(ad) && typeof ad.format === "string" ? ad.format : "image";
        const normalizedFormat = ["image", "video", "native", "text", "carousel"].includes(format)
          ? format
          : "image";

        return {
          brand: String((ad as Record<string, unknown>).brand).trim(),
          product: String((ad as Record<string, unknown>).product).trim(),
          cta: (ad as Record<string, unknown>).cta ? String((ad as Record<string, unknown>).cta).trim() : null,
          landing_domain: (ad as Record<string, unknown>).landing_domain
            ? String((ad as Record<string, unknown>).landing_domain).toLowerCase().trim()
            : null,
          format: normalizedFormat,
          confidence: typeof (ad as Record<string, unknown>).confidence === "number"
            ? ((ad as Record<string, unknown>).confidence as number)
            : 0.75,
        };
      });
  } catch (error) {
    console.error("[Jina] Analysis error:", error);
    throw error;
  }
}
