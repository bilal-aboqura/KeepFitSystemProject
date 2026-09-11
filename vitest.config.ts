import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    fileParallelism: false, environment: "node", setupFiles: ["./tests/setup.ts"], include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/lib/customers/**/*.ts","src/app/api/customer/**/*.ts","src/app/auth/callback/route.ts"] },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/helpers/server-only.ts"),
    },
  },
});
