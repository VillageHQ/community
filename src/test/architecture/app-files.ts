import { readSourceFiles } from "./import-graph";

const ROUTE_GROUP_SEGMENT = /^\(.+\)$/;
const ROUTE_FILE_PATTERN = /^src\/app\/api\/.*\/route\.ts$/;
const PAGE_FILE_PATTERN = /^src\/app\/(.*\/)?page\.tsx$/;
const LAYOUT_FILE_PATTERN = /^src\/app\/.*\/layout\.tsx$/;
const SHARED_LAYOUT_FILE = "src/app/(app)/layout.tsx";

export function readRouteFiles() {
  return readSourceFiles().filter((file) => ROUTE_FILE_PATTERN.test(file));
}

export function readPageFiles() {
  return readSourceFiles().filter((file) => PAGE_FILE_PATTERN.test(file));
}

export function readGuardedLayoutFiles() {
  return readSourceFiles().filter((file) => LAYOUT_FILE_PATTERN.test(file) && file !== SHARED_LAYOUT_FILE);
}

export function toUrlPath(file: string) {
  const segments = file.split("/").slice(2, -1).filter((segment) => !ROUTE_GROUP_SEGMENT.test(segment));
  return `/${segments.join("/")}`;
}

function matches(urlPath: string, ownedPath: string) {
  if (ownedPath === "/") return urlPath === "/";
  return urlPath === ownedPath || urlPath.startsWith(`${ownedPath}/`);
}

type Owner = { id: string; paths: { pages: readonly string[]; api: readonly string[] } };
type PathKind = keyof Owner["paths"];

export function findOwnerId(urlPath: string, owners: readonly Owner[], kind: PathKind) {
  const claims = owners.flatMap(({ id, paths }) => paths[kind].filter((ownedPath) => matches(urlPath, ownedPath)).map((ownedPath) => ({ id, ownedPath })));
  return claims.toSorted((first, second) => second.ownedPath.length - first.ownedPath.length)[0]?.id ?? null;
}
