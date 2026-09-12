import { vi } from "vitest";

export function createR2Mock() {
  const objects = new Map<string, { contentType: string; bytes: number }>();
  return {
    objects,
    createUploadIntent: vi.fn(async (key: string, contentType: string) => ({
      objectKey: key,
      uploadUrl: `https://upload.invalid/${encodeURIComponent(key)}?content-type=${encodeURIComponent(contentType)}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    })),
    headObject: vi.fn(async (key: string) => objects.get(key) ?? null),
    deleteObject: vi.fn(async (key: string) => {
      objects.delete(key);
    }),
  };
}
