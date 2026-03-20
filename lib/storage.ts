import fs from "fs/promises";
import path from "path";
import { Storage } from "@google-cloud/storage";

// Initialize GCS storage if bucket name is provided
const bucketName = process.env.GCS_BUCKET_NAME;
const storage = bucketName ? new Storage() : null;

/**
 * Storage utility to abstract file saving.
 * Supports local filesystem and Google Cloud Storage.
 */
export async function saveFile(key: string, content: Buffer): Promise<string> {
  const isProd = process.env.NODE_ENV === "production";
  
  // 1. Try GCS if configured
  if (storage && bucketName) {
    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(key);
      await file.save(content, {
        resumable: false,
        contentType: key.endsWith(".png") ? "image/png" : "application/octet-stream",
        public: true, // Make public for dashboard access
      });
      console.log(`[Storage] Saved to GCS: ${key}`);
      return `https://storage.googleapis.com/${bucketName}/${key}`;
    } catch (error) {
      console.error(`[Storage] GCS Upload failed for ${key}:`, error);
      if (isProd) return `/${key}`; // Fallback string even if failed
    }
  }

  // 2. Local fallback
  const fullPath = path.join(process.cwd(), "public", key);
  const dir = path.dirname(fullPath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
    console.log(`[Storage] Saved to local: ${fullPath}`);
    return `/${key}`;
  } catch (error) {
    if (isProd) {
      console.error(`[Storage] Local save failed in production: ${key}`, error);
      return `/${key}`; 
    }
    throw error;
  }
}

/**
 * Cleanup utility to delete files or directories.
 */
export async function deleteStoragePath(key: string): Promise<void> {
  // 1. GCS Delete
  if (storage && bucketName) {
    try {
      const bucket = storage.bucket(bucketName);
      // If it's a directory-like key, we need to list and delete
      const [files] = await bucket.getFiles({ prefix: key });
      await Promise.all(files.map(file => file.delete()));
      console.log(`[Storage] Deleted from GCS: ${key}`);
    } catch (error) {
      console.warn(`[Storage] GCS Delete failed for ${key}:`, error);
    }
  }

  // 2. Local Delete
  const fullPath = path.join(process.cwd(), "public", key);
  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`[Storage] Deleted from local: ${fullPath}`);
  } catch (error) {
    console.warn(`[Storage] Local delete failed: ${fullPath}`, error);
  }
}

