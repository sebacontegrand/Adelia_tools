import { put, del, list } from "@vercel/blob";

export async function saveFile(key: string, content: Buffer): Promise<string> {
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
  try {
    const { blobs } = await list({ prefix: key });
    if (blobs.length > 0) {
      await del(blobs.map((b) => b.url));
    }
  } catch (error) {
    console.warn(`[Storage] Blob delete failed for ${key}:`, error);
  }
}
