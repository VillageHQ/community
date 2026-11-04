import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      "server-only": resolve(import.meta.dirname, "src/test/empty-module.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
