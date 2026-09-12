import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminCatalogHandler } from "@/lib/catalog/http";
import { archiveAttributeDefinition, createAttributeDefinition, createAttributeValue, listAttributes, replaceProductSpecifications } from "@/lib/catalog/attributes";

export async function GET() { return adminCatalogHandler(async () => NextResponse.json({ attributes: await listAttributes(true) })); }
export async function POST(request: NextRequest) {
  return adminCatalogHandler(async () => {
    const body = z.object({ kind: z.enum(["definition", "value"]), data: z.unknown() }).parse(await request.json());
    const result = body.kind === "definition" ? await createAttributeDefinition(body.data) : await createAttributeValue(body.data);
    return NextResponse.json({ result }, { status: 201 });
  });
}
export async function DELETE(request: NextRequest) {
  return adminCatalogHandler(async () => {
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get("id"));
    await archiveAttributeDefinition(id);
    return NextResponse.json({ archived: true });
  });
}
export async function PATCH(request: NextRequest) {
  return adminCatalogHandler(async (actorId) => {
    const body = z.object({ kind: z.literal("specifications"), product_id: z.string().uuid(), data: z.unknown() }).parse(await request.json());
    await replaceProductSpecifications(body.product_id, body.data, actorId);
    return NextResponse.json({ updated: true });
  });
}
