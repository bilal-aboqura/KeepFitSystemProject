import { randomUUID } from "node:crypto";
import { commerceDiagnostic } from "./diagnostics";
import type { CommerceErrorCode } from "./types";

export function createCommerceCorrelationId(value?: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : randomUUID();
}

export function recordCommerceDiagnostic(input: {
  code: CommerceErrorCode;
  correlationId: string;
  operation: string;
  metadata?: Record<string, unknown>;
}) {
  console.warn(JSON.stringify({
    domain: "commerce",
    ...commerceDiagnostic(input.code, input.correlationId, input.operation, input.metadata),
  }));
}
