import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PricingCommandError } from "./commands";

export function pricingHttpError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ code: "PRICING_TARGET_INVALID", issues: error.flatten() }, { status: 422 });
  if (error instanceof PricingCommandError) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
  return NextResponse.json({ code: "PRICING_UNAVAILABLE", error: "Pricing service is unavailable" }, { status: 503 });
}
