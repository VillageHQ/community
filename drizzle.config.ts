import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/database/admin-schema.ts",
    "./src/platform/database/auth-schema.ts",
    "./src/platform/branding/schema.ts",
    "./src/database/feed-schema.ts",
    "./src/platform/settings/schema.ts",
    "./src/database/intro-schema.ts",
    "./src/database/members-schema.ts",
    "./src/database/messages-schema.ts",
    "./src/database/village-schema.ts",
  ],
  out: "./drizzle",
});
