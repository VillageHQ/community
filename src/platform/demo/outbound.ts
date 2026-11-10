import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "../http/app-url.ts";
import { DEMO_VILLAGE_API_URL } from "./mode.ts";
import { answerDemoVillage } from "./village-answers.ts";

// In demo mode nothing leaves the server. Every server-side fetch goes through this guard: calls to the app itself
// pass (the self-tick), Village calls get the canned answers, and anything else (Resend, Slack, Discord, hiring-tool
// feeds) fails at once with a plain reason, before any connection is opened.

export const DEMO_OUTSIDE_CALL_MESSAGE = "This is a demo, so nothing is sent outside this server.";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const GUARD_KEY = Symbol.for("community.demo.fetch-guard");
const globalState = globalThis as typeof globalThis & { [GUARD_KEY]?: typeof fetch };

export class DemoOutsideCallError extends Error {
  constructor() {
    super(DEMO_OUTSIDE_CALL_MESSAGE);
    this.name = "DemoOutsideCallError";
  }
}

function readUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input), "http://localhost");
}

function readAppOrigin(environment: Environment) {
  try {
    return resolveAppUrl(environment);
  } catch {
    return null;
  }
}

export function createDemoFetch(original: typeof fetch, environment: Environment): typeof fetch {
  const villageOrigin = new URL(DEMO_VILLAGE_API_URL).origin;
  const appOrigin = readAppOrigin(environment);
  return async (input, init) => {
    const url = readUrl(input);
    if (url.origin === villageOrigin) return answerDemoVillage(new Request(input, init));
    if (LOCAL_HOSTS.has(url.hostname) || url.origin === appOrigin) return original(input, init);
    throw new DemoOutsideCallError();
  };
}

// Installed once at boot (instrumentation) when DEMO_MODE=true. Returns a function that puts the real fetch back.
export function installDemoFetchGuard(environment: Environment) {
  if (globalState[GUARD_KEY]) return () => undefined;
  const original = globalThis.fetch;
  globalState[GUARD_KEY] = original;
  globalThis.fetch = createDemoFetch(original, environment);
  return () => {
    globalThis.fetch = original;
    delete globalState[GUARD_KEY];
  };
}
