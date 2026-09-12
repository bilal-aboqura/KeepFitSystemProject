import { NextResponse, type NextRequest } from "next/server";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archivePackagingUnit } from "@/lib/catalog/packaging-commands";

export async function POST(_request: NextRequest, context: { params: Promise<{ unitId: string }> }) {
  return adminCatalogHandler(async (actorId) => {
    const { unitId } = await context.params;
    await archivePackagingUnit(unitId, actorId);
    return NextResponse.json({ archived: true });
  });
}
