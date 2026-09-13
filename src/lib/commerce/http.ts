import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { CommerceError, toCommercePublicError } from "./errors";

export async function parseCommerceBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CommerceError("INVALID_JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new CommerceError("INVALID_JSON", { status: 422 });
  return parsed.data;
}

export function commerceErrorResponse(error: unknown) {
  const publicError = toCommercePublicError(error);
  const status = error instanceof CommerceError ? error.status : 503;
  return NextResponse.json({ error: publicError, ...(error instanceof CommerceError && error.quote ? { quote: error.quote } : {}) }, { status });
}
