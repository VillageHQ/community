import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";

import ts from "typescript";

export const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/;
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const DECLARATION_FILE_PATTERN = /\.d\.ts$/;
const COMPILED_EXTENSION_PATTERN = /\.jsx?$/;
const LOCAL_SPECIFIER_PATTERN = /^(@\/|\.)/;
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

export type ImportEdge = { from: string; to: string };

function isFileInRepository(path: string) {
  const absolutePath = resolve(REPOSITORY_ROOT, path);
  return existsSync(absolutePath) && statSync(absolutePath).isFile();
}

function toRepositoryPath(importer: string, specifier: string) {
  if (specifier.startsWith("@/")) return posix.normalize(`src/${specifier.slice(2)}`);
  if (specifier.startsWith(".")) return posix.join(dirname(importer), specifier);
  return null;
}

export function resolveSpecifier(importer: string, specifier: string) {
  const path = toRepositoryPath(importer, specifier);
  if (path === null) return null;
  const compiledPathSource = path.replace(COMPILED_EXTENSION_PATTERN, "");
  const candidates = [...CANDIDATE_SUFFIXES.map((suffix) => `${path}${suffix}`), `${compiledPathSource}.ts`, `${compiledPathSource}.tsx`];
  return candidates.find(isFileInRepository) ?? null;
}

export function readImportSpecifiers(file: string) {
  const text = readFileSync(resolve(REPOSITORY_ROOT, file), "utf8");
  return ts.preProcessFile(text, true, true).importedFiles.map(({ fileName }) => fileName);
}

function readTrackedFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: REPOSITORY_ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

export function readSourceFiles() {
  return readTrackedFiles().filter(
    (file) => file.startsWith("src/") && SOURCE_FILE_PATTERN.test(file) && !DECLARATION_FILE_PATTERN.test(file) && existsSync(resolve(REPOSITORY_ROOT, file)),
  );
}

export function isTestFile(file: string) {
  return TEST_FILE_PATTERN.test(file) || file.startsWith("src/test/");
}

export function readImportEdges(files: readonly string[]): ImportEdge[] {
  return files.flatMap((from) =>
    readImportSpecifiers(from).flatMap((specifier) => {
      const to = resolveSpecifier(from, specifier);
      return to && SOURCE_FILE_PATTERN.test(to) ? [{ from, to }] : [];
    }),
  );
}

export function readUnresolvedImports(files: readonly string[]) {
  return files.flatMap((file) =>
    readImportSpecifiers(file)
      .filter((specifier) => LOCAL_SPECIFIER_PATTERN.test(specifier) && resolveSpecifier(file, specifier) === null)
      .map((specifier) => `${file} -> ${specifier}`),
  );
}

export function findSelfImports(edges: readonly ImportEdge[]) {
  return edges.filter(({ from, to }) => from === to).map(({ from }) => from);
}

export function findComputedImports(fileName: string, text: string) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const computed: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && !node.arguments.every(ts.isStringLiteral)) {
      computed.push(node.getText());
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return computed;
}

export function readComputedImports(files: readonly string[]) {
  return files.flatMap((file) => findComputedImports(file, readFileSync(resolve(REPOSITORY_ROOT, file), "utf8")).map((call) => `${file}: ${call}`));
}

export function followImports(entryFiles: readonly string[]) {
  const seen = new Set<string>();
  const pending = [...entryFiles];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const { to } of readImportEdges([file])) pending.push(to);
  }
  return [...seen];
}

// Tarjan's algorithm. A group of more than one node is a cycle.
export function findCycles(edges: readonly ImportEdge[]) {
  const neighbours = new Map<string, string[]>();
  for (const { from, to } of edges) neighbours.set(from, [...(neighbours.get(from) ?? []), to]);

  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  function visit(node: string) {
    indexes.set(node, indexes.size);
    lowLinks.set(node, indexes.get(node) ?? 0);
    stack.push(node);
    onStack.add(node);

    for (const neighbour of neighbours.get(node) ?? []) {
      if (!indexes.has(neighbour)) {
        visit(neighbour);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(neighbour) ?? 0));
      } else if (onStack.has(neighbour)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indexes.get(neighbour) ?? 0));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const group: string[] = [];
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member);
      group.push(member);
      if (member === node) break;
    }
    if (group.length > 1) cycles.push(group.toSorted());
  }

  for (const node of neighbours.keys()) if (!indexes.has(node)) visit(node);
  return cycles.map((cycle) => cycle.join(" <-> ")).toSorted();
}
