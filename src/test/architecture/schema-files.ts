import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import drizzleConfig from "../../../drizzle.config";
import { REPOSITORY_ROOT } from "./import-graph";

export const TABLE_NAME_PATTERN = /pgTable\(\s*"([^"]+)"/g;

export function readSchemaPatterns() {
  const schema = drizzleConfig.schema ?? [];
  return typeof schema === "string" ? [schema] : schema;
}

export function readLoadedSchemaFiles() {
  return readSchemaPatterns().flatMap((pattern) => globSync(pattern, { cwd: REPOSITORY_ROOT })).toSorted();
}

export function readDeclaredTables(file: string) {
  const text = readFileSync(resolve(REPOSITORY_ROOT, file), "utf8");
  return [...text.matchAll(TABLE_NAME_PATTERN)].flatMap(([, name]) => (name ? [name] : []));
}
