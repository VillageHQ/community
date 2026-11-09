import { getDatabase } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { API_ROUTES } from "../http/routes.ts";
import { logError } from "../observability/route-logging.ts";
import { resolveTickSecret } from "./tick-secret.ts";

const TICK_INTERVAL_MS = 60_000;
const TICK_TIMEOUT_MS = 50_000;
const DEFAULT_PORT = "3000";
const SELF_TICK_ON = "true";

// A long-running server (the VPS install) calls its own tick endpoint every minute, so timed
// jobs run with no outside scheduler. Going through the endpoint keeps one way in for every host.
export function startSelfTick(environment: Environment) {
  if (environment.JOBS_SELF_TICK !== SELF_TICK_ON) return null;
  const url = `http://127.0.0.1:${environment.PORT || DEFAULT_PORT}${API_ROUTES.jobsTick}`;

  const tick = async () => {
    try {
      const secret = await resolveTickSecret(getDatabase(), environment);
      if (!secret) throw new Error("JOBS_TICK_SECRET is shorter than 32 characters, so timed jobs are off.");
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(TICK_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`The tick endpoint answered ${response.status}.`);
    } catch (error) {
      logError("jobs-self-tick", error);
    }
  };
  const timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  timer.unref();
  return timer;
}
