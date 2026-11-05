import { moduleStateBodySchema } from "@/modules/admin/contract-modules";
import { adminRoutes } from "@/modules/admin/routes";
import { setModuleState } from "@/shell/module-settings";

export const POST = adminRoutes.member(
  "admin-module-state",
  moduleStateBodySchema,
  async (context, body) => Response.json({ message: await setModuleState(context, body) }),
  { adminOnly: true },
);
