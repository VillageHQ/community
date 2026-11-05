import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/platform/database/auth-schema.ts", "./src/platform/*/schema.ts", "./src/modules/*/schema.ts"],
  out: "./drizzle",
});
