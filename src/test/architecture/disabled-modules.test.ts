import { resolve } from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST as readFeed } from "@/app/api/feed/route";
import { POST as readIntroBoard } from "@/app/api/intros/route";
import { feedManifest } from "@/modules/feed/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { MODULES } from "@/modules/registry";
import { REQUEST_ERROR_CODES } from "@/platform/http/error-codes";
import { saveModuleState } from "@/platform/modules/enablement";
import { MODULE_KINDS, type ToggleableManifest } from "@/platform/modules/manifest";
import { readRouteFacts } from "@/platform/modules/route-facts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedPost } from "@/test/feed";
import { createSignedInMember } from "@/test/signed-in-member";

import { findOwnerId, readGuardedLayoutFiles, readPageFiles, readRouteFiles, toUrlPath } from "./app-files";
import { REPOSITORY_ROOT } from "./import-graph";

const APP_URL = "http://localhost:3000";
const SUCCESS_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const POST_BODY = "Still here after the switch.";
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";
const HTTP_METHODS = new Set(["GET", "POST", "DELETE"]);

const manifests = MODULES.map(({ manifest }) => manifest);
const toggleable = manifests.filter((manifest): manifest is ToggleableManifest => manifest.kind === MODULE_KINDS.toggleable);

function filesOwnedBy(files: readonly string[], manifest: ToggleableManifest, kind: "api" | "pages") {
  return files.filter((file) => findOwnerId(toUrlPath(file), manifests, kind) === manifest.id);
}

function jsonRequest(path: string, cookie: string) {
  return new Request(`${APP_URL}${path}`, { method: "POST", headers: { origin: APP_URL, cookie, "content-type": "application/json" }, body: "{}" });
}

function loadFile(file: string) {
  return import(/* @vite-ignore */ resolve(REPOSITORY_ROOT, file));
}

function hasDigest(error: unknown): error is { digest: string } {
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string";
}

async function readRejectionDigest(rendering: Promise<unknown>) {
  try {
    await rendering;
    return null;
  } catch (error) {
    return hasDigest(error) ? error.digest : null;
  }
}

describe("a module that's turned off", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe.each(toggleable.map((manifest) => ({ id: manifest.id, manifest })))("$id", ({ manifest }) => {
    beforeEach(async () => {
      await saveModuleState(database, manifest, false);
    });

    it("answers 404 from every route it owns", async () => {
      const { cookie } = await createSignedInMember(database, "admin");
      const answers = await Promise.all(
        filesOwnedBy(readRouteFiles(), manifest, "api").map(async (file) => {
          const routeModule = await loadFile(file);
          const handlers = Object.entries(routeModule).filter(([name]) => HTTP_METHODS.has(name));
          return Promise.all(
            handlers.flatMap(([name, handler]) => {
              if (typeof handler !== "function" || readRouteFacts(handler)?.staysOpenWhenOff) return [];
              const request = new Request(`${APP_URL}${toUrlPath(file)}`, {
                method: name,
                headers: { origin: APP_URL, cookie, "content-type": "application/json" },
                body: name === "GET" ? undefined : "{}",
              });
              return [Promise.resolve(handler(request)).then((response: Response) => ({ file, status: response.status }))];
            }),
          );
        }),
      );

      const answered = answers.flat();
      expect(answered.length).toBeGreaterThan(0);
      expect(answered.filter(({ status }) => status !== NOT_FOUND_STATUS)).toEqual([]);
    });

    it("renders no page or layout it owns", async () => {
      const files = filesOwnedBy([...readPageFiles(), ...readGuardedLayoutFiles()], manifest, "pages");
      const digests = await Promise.all(
        files.map(async (file) => {
          const { default: page } = await loadFile(file);
          return { file, digest: await readRejectionDigest(page({ params: Promise.resolve({}), searchParams: Promise.resolve({}), children: null })) };
        }),
      );

      expect(digests.filter(({ digest }) => digest !== NOT_FOUND_DIGEST)).toEqual([]);
    });
  });

  it("explains itself instead of answering a bare not found", async () => {
    const { cookie } = await createSignedInMember(database);
    await saveModuleState(database, feedManifest, false);

    const response = await readFeed(jsonRequest("/api/feed", cookie));

    expect(await response.json()).toMatchObject({ code: REQUEST_ERROR_CODES.moduleOff, message: expect.stringContaining("turned this off") });
  });

  // Pausing a module whose requirement is off is covered in src/platform/modules/enablement.test.ts. No module
  // requires another today: intros works without network (asks from profiles).
  it("keeps intros on with network off", async () => {
    const { cookie } = await createSignedInMember(database);
    await saveModuleState(database, networkManifest, false);

    expect((await readIntroBoard(jsonRequest("/api/intros", cookie))).status).toBe(SUCCESS_STATUS);
  });

  it("shows its data again when it comes back on", async () => {
    const author = await createSignedInMember(database);
    await seedPost(database, { authorId: author.userId, body: POST_BODY });
    await saveModuleState(database, feedManifest, false);

    expect((await readFeed(jsonRequest("/api/feed", author.cookie))).status).toBe(NOT_FOUND_STATUS);

    await saveModuleState(database, feedManifest, true);
    const response = await readFeed(jsonRequest("/api/feed", author.cookie));

    expect(await response.text()).toContain(POST_BODY);
  });
});
