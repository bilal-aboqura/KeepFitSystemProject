import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archiveCatalogMedia, updateCatalogMedia } from "@/lib/catalog/media";

export async function PATCH(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { mediaId } = await context.params;
    z.string().uuid().parse(mediaId);
    const input = z.object({ sort_order: z.number().int().min(0).optional(), is_primary: z.boolean().optional() }).parse(await request.json());
    await updateCatalogMedia(mediaId, input, actorId);
    return NextResponse.json({ updated: true });
  });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { mediaId } = await context.params;
    z.string().uuid().parse(mediaId);
    await archiveCatalogMedia(mediaId, actorId);
    return NextResponse.json({ archived: true });
  });
}
