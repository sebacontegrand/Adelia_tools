/**
 * Image deduplication using perceptual hashing.
 * Computes pHash of ad images and compares against existing ads in the database.
 */

import crypto from "crypto";

/**
 * Compute a perceptual hash of an image buffer using a simplified dHash algorithm.
 * dHash (difference hash) is fast and effective for near-duplicate detection.
 *
 * Algorithm:
 * 1. Resize image to 9x8 (for 8x8 gradient comparison)
 * 2. Convert to grayscale
 * 3. Compare adjacent pixels left-to-right
 * 4. Generate 64-bit hash
 */
export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;

  // Resize to 9x8 and convert to raw grayscale
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute dHash: compare adjacent pixels
  let hash = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash += left < right ? "1" : "0";
    }
  }

  // Convert binary string to hex
  let hexHash = "";
  for (let i = 0; i < hash.length; i += 4) {
    hexHash += parseInt(hash.substring(i, i + 4), 2).toString(16);
  }

  return hexHash;
}

/**
 * Calculate the Hamming distance between two hex hash strings.
 * Lower = more similar. 0 = identical.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error(`Hash length mismatch: ${hash1.length} vs ${hash2.length}`);
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count set bits in XOR result
    distance += popcount4(xor);
  }
  return distance;
}

/** Count set bits in a 4-bit number */
function popcount4(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

/**
 * Check if two images are similar based on their perceptual hashes.
 * Threshold of 5 works well for near-duplicate detection.
 */
export function isSimilar(hash1: string, hash2: string, threshold = 5): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Find similar ads in a list of existing hashes.
 * Returns the index of the most similar match, or -1 if no match found.
 */
export function findMostSimilar(
  targetHash: string,
  existingHashes: { id: string; hash: string }[],
  threshold = 5
): { id: string; distance: number } | null {
  let bestMatch: { id: string; distance: number } | null = null;

  for (const existing of existingHashes) {
    const distance = hammingDistance(targetHash, existing.hash);
    if (distance <= threshold) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { id: existing.id, distance };
      }
    }
  }

  return bestMatch;
}

/**
 * Compute a simple content hash (SHA-256) for exact duplicate detection.
 */
export function computeContentHash(imageBuffer: Buffer): string {
  return crypto.createHash("sha256").update(imageBuffer).digest("hex");
}
