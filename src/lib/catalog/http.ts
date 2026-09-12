import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { CatalogError } from "./errors";

export async function adminCatalogHandler(run: (actorId: string) => Promise<Response>) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  try {
    const response = await run(auth.user.id);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 422 });
    if (error instanceof CatalogError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("Catalog command failed", error);
    return NextResponse.json({ error: "Catalog service unavailable" }, { status: 503 });
  }
}
