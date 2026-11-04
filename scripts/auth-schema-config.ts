import { createDatabase } from "../src/database/client.ts";
import { createAuth } from "../src/lib/create-auth.ts";

const SCHEMA_GENERATION_SECRET = "only-used-to-generate-the-auth-schema";
const UNUSED_CONNECTION_STRING = "postgres://schema-generation.invalid/unused";

export const auth = createAuth(
  SCHEMA_GENERATION_SECRET,
  createDatabase(UNUSED_CONNECTION_STRING, {}),
  process.env,
);
