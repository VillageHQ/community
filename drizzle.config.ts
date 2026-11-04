import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/database/auth-schema.ts", "./src/database/instance-settings.ts"],
  out: "./drizzle",
});
