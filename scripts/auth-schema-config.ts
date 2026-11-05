import { createDatabase } from "../src/platform/database/client.ts";
import { createAuth } from "../src/platform/auth/create-auth.ts";

const SCHEMA_GENERATION_SECRET = "only-used-to-generate-the-auth-schema";
const UNUSED_CONNECTION_STRING = "postgres://schema-generation.invalid/unused";

export const auth = createAuth(
  SCHEMA_GENERATION_SECRET,
  createDatabase(UNUSED_CONNECTION_STRING, {}),
  process.env,
);
