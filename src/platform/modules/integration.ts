import type { Database, Transaction } from "../database/client.ts";
import type { ScheduledJob } from "../jobs/runner.ts";
import type { ModuleManifest } from "./manifest.ts";

export type MemberRemoval = { memberId: string; memberName: string; actorId: string; keepsContent: boolean };

// read* and jobs run only when the module is on. on* always runs, because it keeps retained data correct.
export type ModuleIntegration = {
  manifest: ModuleManifest;
  readNavigationBadge?: (database: Database, memberId: string) => Promise<number>;
  onMemberBlocked?: (transaction: Transaction, blockerId: string, blockedId: string) => Promise<void>;
  onMemberRemoved?: (transaction: Transaction, removal: MemberRemoval) => Promise<void>;
  jobs?: readonly ScheduledJob[];
};
