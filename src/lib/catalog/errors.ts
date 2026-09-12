export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "catalog_error",
  ) {
    super(message);
  }
}

export function catalogDatabaseError(error: { code?: string; message?: string }): CatalogError {
  if (error.code === "23505") return new CatalogError("SKU or active variant combination already exists", 409, "catalog_conflict");
  if (error.code === "23514" || error.code === "22023") return new CatalogError(error.message ?? "Catalog validation failed", 422, "catalog_validation");
  return new CatalogError("Catalog service unavailable", 503, "catalog_unavailable");
}
