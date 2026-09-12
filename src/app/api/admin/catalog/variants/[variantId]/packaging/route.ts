import { NextResponse, type NextRequest } from "next/server";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { listVariantPackaging, replaceVariantPackaging } from "@/lib/catalog/packaging-commands";

export async function GET(_request: NextRequest, context: { params: Promise<{ variantId: string }> }) {
  return adminCatalogHandler(async () => {
    const { variantId } = await context.params;
    return NextResponse.json({ units: await listVariantPackaging(variantId) });
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ variantId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { variantId } = await context.params;
    return NextResponse.json({ units: await replaceVariantPackaging(variantId, await request.json(), actorId) });
  });
}
