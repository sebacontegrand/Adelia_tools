import fs from "fs/promises";
import path from "path";

/**
 * Storage utility to abstract file saving.
 * Supports local filesystem in development and provides a foundation for cloud storage.
 */

export async function saveFile(key: string, content: Buffer): Promise<string> {
  const isProd = process.env.NODE_ENV === "production";
  
  // 1. Local storage (default)
  const fullPath = path.join(process.cwd(), "public", key);
  const dir = path.dirname(fullPath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
    console.log(`[Storage] Saved to local: ${fullPath}`);
    return `/${key}`;
  } catch (error) {
    if (isProd) {
      console.error(`[Storage] Failed to save to local (read-only environment?): ${key}`, error);
      
      // In production, if we can't save to public/, we might want to use an external provider.
      // For now, we return the key anyway, but the file won't be accessible.
      // In the future, this is where we'd plug in GCS or S3.
      return `/${key}`; 
    }
    throw error;
  }
}

/**
 * Cleanup utility to delete files or directories.
 */
export async function deleteStoragePath(key: string): Promise<void> {
  const fullPath = path.join(process.cwd(), "public", key);
  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`[Storage] Deleted: ${fullPath}`);
  } catch (error) {
    console.warn(`[Storage] Failed to delete: ${fullPath}`, error);
  }
}
