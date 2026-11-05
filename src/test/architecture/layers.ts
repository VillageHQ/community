const MODULE_PATH_PATTERN = /^src\/modules\/([^/]+)\/(.+)$/;
const PUBLIC_ROLE_PATTERN = /^((contract|queries|reads|schema|service|slots|limits)(-[a-z-]+)?\.tsx?|components\/shared\/.+)$/;

export const LAYERS = {
  app: "app",
  shell: "shell",
  module: "module",
  registry: "registry",
  components: "components",
  platform: "platform",
  other: "other",
} as const;

export type Layer = (typeof LAYERS)[keyof typeof LAYERS];

// A module may import only the modules listed here. Admin sits on top of the features it manages.
const ALLOWED_MODULE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
  members: [],
  messages: ["members"],
  feed: ["members"],
  network: ["members"],
  intros: ["members", "network"],
  admin: ["members", "messages", "feed", "network", "intros"],
};

const LAYER_PREFIXES: readonly (readonly [string, Layer])[] = [
  ["src/app/", LAYERS.app],
  ["src/shell/", LAYERS.shell],
  ["src/modules/registry", LAYERS.registry],
  ["src/modules/", LAYERS.module],
  ["src/components/", LAYERS.components],
  ["src/platform/", LAYERS.platform],
];

const ALLOWED_LAYER_IMPORTS: Readonly<Record<Layer, ReadonlySet<Layer>>> = {
  [LAYERS.app]: new Set([LAYERS.app, LAYERS.shell, LAYERS.registry, LAYERS.module, LAYERS.components, LAYERS.platform, LAYERS.other]),
  [LAYERS.shell]: new Set([LAYERS.shell, LAYERS.registry, LAYERS.module, LAYERS.components, LAYERS.platform, LAYERS.other]),
  [LAYERS.registry]: new Set([LAYERS.module, LAYERS.platform]),
  [LAYERS.module]: new Set([LAYERS.module, LAYERS.components, LAYERS.platform]),
  [LAYERS.components]: new Set([LAYERS.components, LAYERS.platform]),
  [LAYERS.platform]: new Set([LAYERS.platform]),
  [LAYERS.other]: new Set([LAYERS.platform, LAYERS.other]),
};

export function readLayer(file: string): Layer {
  return LAYER_PREFIXES.find(([prefix]) => file.startsWith(prefix))?.[1] ?? LAYERS.other;
}

export function readModuleName(file: string) {
  return file.match(MODULE_PATH_PATTERN)?.[1] ?? null;
}

function isModuleEdgeAllowed(from: string, to: string) {
  const importer = readModuleName(from);
  const imported = readModuleName(to);
  if (importer === null || imported === null || importer === imported) return true;
  const role = to.match(MODULE_PATH_PATTERN)?.[2] ?? "";
  return (ALLOWED_MODULE_IMPORTS[importer] ?? []).includes(imported) && PUBLIC_ROLE_PATTERN.test(role);
}

export function isEdgeAllowed(from: string, to: string) {
  if (!ALLOWED_LAYER_IMPORTS[readLayer(from)].has(readLayer(to))) return false;
  return isModuleEdgeAllowed(from, to);
}
