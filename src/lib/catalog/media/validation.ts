import "server-only";
import { mediaConfirmSchema, mediaUploadIntentSchema } from "../validation";

export { mediaConfirmSchema, mediaUploadIntentSchema };

export const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function normalizeCatalogPrefix(value: string | undefined) {
  const prefix = (value || "development").trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9/_-]+$/.test(prefix)) throw new Error("Invalid R2 catalog prefix");
  return prefix;
}

export function detectCatalogImageMime(bytes: Uint8Array) {
  const ascii = new TextDecoder("ascii").decode(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.slice(4, 12).startsWith("ftypavif") || ascii.slice(4, 12).startsWith("ftypavis")) return "image/avif";
  return "";
}
