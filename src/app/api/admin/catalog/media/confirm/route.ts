import { NextResponse, type NextRequest } from "next/server";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { confirmCatalogUpload } from "@/lib/catalog/media";

export async function POST(request: NextRequest) {
  return adminCatalogHandler(async (actorId) => NextResponse.json(await confirmCatalogUpload(await request.json(), actorId), { status: 201 }));
}
