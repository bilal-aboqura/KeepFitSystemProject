import "server-only";

export interface CatalogUploadIntent {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface CatalogMediaStorage {
  createUploadIntent(input: {
    mediaId: string;
    productId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
  }): Promise<CatalogUploadIntent>;
  verifyObject(objectKey: string): Promise<{ mimeType: string; byteSize: number }>;
  buildPublicUrl(objectKey: string): string;
  deleteObject(objectKey: string): Promise<void>;
}
