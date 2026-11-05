import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/database/auth-schema.ts",
    "./src/database/branding-schema.ts",
    "./src/database/feed-schema.ts",
    "./src/database/instance-settings.ts",
    "./src/database/members-schema.ts",
    "./src/database/messages-schema.ts",
    "./src/database/village-schema.ts",
  ],
  out: "./drizzle",
});
