/**
 * Confidence scoring for extracted ads.
 * Combines multiple signals to determine how reliable an extraction is.
 */

import { OcrResult } from "./ocr";
import { AdExtraction } from "./extract";

export interface ConfidenceFactors {
  ocrConfidence: number;       // From OCR module (0-1)
  extractionConfidence: number; // From Gemini extraction (0-1)
  brandMatchScore: number;     // Does brand match known brands? (0-1)
  fieldCompleteness: number;   // How many fields were filled? (0-1)
  sizeReasonability: number;   // Is the ad size reasonable? (0-1)
  dedupNovelty: number;        // Known ad = 0.9, new = 0.5
}

/**
 * Compute overall confidence score from multiple signals.
 */
export function computeConfidence(
  ocr: OcrResult,
  extraction: AdExtraction,
  options: {
    isKnownCampaign: boolean;
    width: number;
    height: number;
    knownBrands?: string[];
  }
): { score: number; factors: ConfidenceFactors } {
  const factors: ConfidenceFactors = {
    ocrConfidence: ocr.confidence,
    extractionConfidence: extraction.confidence,
    brandMatchScore: computeBrandScore(extraction.brand, options.knownBrands),
    fieldCompleteness: computeFieldCompleteness(extraction),
    sizeReasonability: computeSizeScore(options.width, options.height),
    dedupNovelty: options.isKnownCampaign ? 0.9 : 0.5,
  };

  // Weighted average
  const weights = {
    ocrConfidence: 0.15,
    extractionConfidence: 0.30,
    brandMatchScore: 0.15,
    fieldCompleteness: 0.15,
    sizeReasonability: 0.10,
    dedupNovelty: 0.15,
  };

  const score = Object.keys(weights).reduce((total, key) => {
    const k = key as keyof ConfidenceFactors;
    return total + factors[k] * weights[k];
  }, 0);

  return { score: Math.round(score * 100) / 100, factors };
}

function computeBrandScore(brand: string, knownBrands?: string[]): number {
  if (!brand || brand === "Unknown") return 0.2;
  if (!knownBrands || knownBrands.length === 0) return 0.6;
  
  const normalized = brand.toLowerCase().trim();
  const found = knownBrands.some(
    (kb) => normalized.includes(kb.toLowerCase()) || kb.toLowerCase().includes(normalized)
  );
  return found ? 1.0 : 0.5;
}

function computeFieldCompleteness(extraction: AdExtraction): number {
  const fields = [
    extraction.brand !== "Unknown",
    extraction.product !== "Unknown",
    extraction.campaignName !== "",
    extraction.cta !== null,
    extraction.adFormat !== "Display Ad",
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function computeSizeScore(width: number, height: number): number {
  // Standard IAB ad sizes get full score
  const standards = [
    [728, 90], [300, 250], [160, 600], [300, 600],
    [970, 250], [970, 90], [320, 50], [320, 100], [250, 250],
  ];

  for (const [w, h] of standards) {
    const wRatio = width / w;
    const hRatio = height / h;
    if (wRatio >= 0.7 && wRatio <= 1.3 && hRatio >= 0.7 && hRatio <= 1.3) {
      return 1.0;
    }
  }

  // Reasonable dimensions (not too tiny, not too huge)
  if (width >= 90 && height >= 40 && width <= 2000 && height <= 2000) {
    return 0.7;
  }

  return 0.3;
}

/**
 * Determine the review status based on confidence score.
 */
export function getReviewStatus(score: number): "auto_approved" | "pending" {
  return score >= 0.8 ? "auto_approved" : "pending";
}

/**
 * Get the reason for requiring review.
 */
export function getReviewReason(
  score: number,
  factors: ConfidenceFactors
): string | null {
  if (score >= 0.8) return null;
  if (score < 0.5) return "low_confidence";
  if (factors.brandMatchScore < 0.4) return "new_brand";
  if (factors.ocrConfidence < 0.4) return "low_ocr_quality";
  return "needs_verification";
}
