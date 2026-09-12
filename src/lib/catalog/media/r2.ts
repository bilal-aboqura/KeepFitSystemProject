import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CatalogMediaStorage } from "./storage";
import { detectCatalogImageMime, extensionByMime, normalizeCatalogPrefix } from "./validation";

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.NEXT_PUBLIC_R2_MEDIA_BASE_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error("R2 catalog media is not configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl: publicBaseUrl.replace(/\/$/, ""), prefix: normalizeCatalogPrefix(process.env.R2_CATALOG_PREFIX) };
}

export function createR2CatalogStorage(): CatalogMediaStorage {
  const config = r2Config();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async createUploadIntent(input) {
      const extension = extensionByMime[input.mimeType];
      if (!extension) throw new Error("Unsupported catalog media type");
      const objectKey = `${config.prefix}/catalog/products/${input.productId}/${input.mediaId}.${extension}`;
      const command = new PutObjectCommand({ Bucket: config.bucket, Key: objectKey, ContentType: input.mimeType, ContentLength: input.byteSize });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      return { mediaId: input.mediaId, objectKey, uploadUrl, expiresAt: new Date(Date.now() + 300_000).toISOString() };
    },
    async verifyObject(objectKey) {
      const [object, sample] = await Promise.all([
        client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey })),
        client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey, Range: "bytes=0-15" })),
      ]);
      const bytes = sample.Body ? await sample.Body.transformToByteArray() : new Uint8Array();
      const detected = detectCatalogImageMime(bytes);
      return { mimeType: detected && detected === object.ContentType ? detected : "", byteSize: object.ContentLength ?? 0 };
    },
    buildPublicUrl(objectKey) {
      return `${config.publicBaseUrl}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
    },
    async deleteObject(objectKey) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    },
  };
}
