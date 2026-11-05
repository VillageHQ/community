import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";

const DEFAULT_ROUTE_DEADLINE_MS = 60_000;

export type SessionMember = { id: string; email: string; role?: string | null };

export type NetworkContext = {
  database: Database;
  environment: Environment;
  member: SessionMember;
  deadlineAtMs: number;
};

export function createNetworkContext(
  database: Database,
  environment: Environment,
  member: SessionMember,
  deadlineMs = DEFAULT_ROUTE_DEADLINE_MS,
): NetworkContext {
  return { database, environment, member, deadlineAtMs: Date.now() + deadlineMs };
}
