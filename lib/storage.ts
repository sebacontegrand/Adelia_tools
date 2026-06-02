import { put, del, list } from "@vercel/blob";

const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveFile(key: string, content: Buffer): Promise<string> {
  if (!hasBlobToken) {
    console.warn("[Storage] BLOB_READ_WRITE_TOKEN not set — images won't persist. Set up Vercel Blob storage in dashboard.");
    return `/${key}`;
  }
  try {
    const { url } = await put(key, content, {
      access: "public",
      contentType: key.endsWith(".png") ? "image/png" : "application/octet-stream",
      addRandomSuffix: false,
    });
    return url;
  } catch (error) {
    console.error(`[Storage] Blob upload failed for ${key}:`, error);
    return `/${key}`;
  }
}

export async function deleteStoragePath(key: string): Promise<void> {
  if (!hasBlobToken) return;
  try {
    const { blobs } = await list({ prefix: key });
    if (blobs.length > 0) {
      await del(blobs.map((b) => b.url));
    }
  } catch (error) {
    console.warn(`[Storage] Blob delete failed for ${key}:`, error);
  }
}
