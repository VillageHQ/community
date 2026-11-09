import { fillInBasisBodySchema } from "@/modules/members/contract-fill-in";
import { saveFillInBasis } from "@/modules/network/service-fill-in";
import { logAdminAction } from "@/platform/observability/route-logging";
import { networkRoutes } from "@/modules/network/routes";

const SAVED_MESSAGES = {
  off: "Saved. Nobody is looked up.",
  ask: "Saved. Each member is asked first, the next time they open the site.",
  terms: "Saved. Members are filled in tonight, unless they said no.",
} as const;

export const POST = networkRoutes.member(
  "admin-fill-in-basis",
  fillInBasisBodySchema,
  async (context, body) => {
    await saveFillInBasis(context, body);
    logAdminAction("fill_in_basis_changed", context.member.id, body.basis);
    return Response.json({ message: SAVED_MESSAGES[body.basis] });
  },
  { adminOnly: true },
);
