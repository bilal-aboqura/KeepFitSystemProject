import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archiveCatalogVariant, updateCatalogVariant } from "@/lib/catalog/variants";

export async function PATCH(request: NextRequest, context: { params: Promise<{ variantId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { variantId } = await context.params;
    z.string().uuid().parse(variantId);
    const variant = await updateCatalogVariant(variantId, await request.json(), actorId);
    return NextResponse.json({ variant });
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ variantId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { variantId } = await context.params;
    z.string().uuid().parse(variantId);
    await archiveCatalogVariant(variantId, actorId);
    return NextResponse.json({ archived: true });
  });
}
