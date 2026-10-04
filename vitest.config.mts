import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // `server-only` throws outside React Server Components; tests import server modules directly.
    alias: { "server-only": path.resolve(import.meta.dirname, "test/empty.ts") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    // DB integration tests share one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
