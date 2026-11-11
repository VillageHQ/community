import { runVillageCheck } from "@/modules/network/service-village-check";
import { networkRoutes } from "@/modules/network/routes";
import { emptyBodySchema } from "@/platform/http/contract";

const DEADLINE_MS = 55_000;

export const maxDuration = 60;

// Asks Village (free calls only) about the keys, the group and every member, and stores the answer.
export const POST = networkRoutes.member(
  "village-check",
  emptyBodySchema,
  async (context) => {
    await runVillageCheck(context);
    return Response.json({ message: "Checked." });
  },
  { adminOnly: true, deadlineMs: DEADLINE_MS },
);
