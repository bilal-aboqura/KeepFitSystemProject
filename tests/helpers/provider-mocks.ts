import { vi } from "vitest";

type ProviderName = "kashier" | "bosta" | "mylerz" | "notification" | "meta" | "analytics";

function failClosedProvider(name: ProviderName) {
  return vi.fn(async () => {
    throw new Error(`Unexpected live ${name} provider call`);
  });
}

export function createProviderMocks() {
  return {
    kashier: failClosedProvider("kashier"),
    bosta: failClosedProvider("bosta"),
    mylerz: failClosedProvider("mylerz"),
    notification: failClosedProvider("notification"),
    meta: failClosedProvider("meta"),
    analytics: failClosedProvider("analytics"),
  };
}

export type ProviderMocks = ReturnType<typeof createProviderMocks>;
