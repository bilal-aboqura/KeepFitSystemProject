import { NextResponse, type NextRequest } from "next/server";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { createCatalogUploadIntent } from "@/lib/catalog/media";

export async function POST(request: NextRequest) {
  return adminCatalogHandler(async () => NextResponse.json(await createCatalogUploadIntent(await request.json()), { status: 201 }));
}
