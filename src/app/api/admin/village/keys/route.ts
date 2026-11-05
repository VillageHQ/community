import { z } from "zod";

import { verifyAndSaveVillageKeys } from "@/lib/village/member-network";
import { createMemberRoute } from "@/platform/village/member-routes";

const keysBodySchema = z.object({
  publicKey: z.string().trim().min(1, "Enter the public key."),
  secretKey: z.string().trim().min(1, "Enter the secret key."),
});

export const POST = createMemberRoute(
  "village-keys",
  keysBodySchema,
  async (context, body) => {
    await verifyAndSaveVillageKeys(context, body);
    return Response.json({ message: "Village keys saved." });
  },
  { adminOnly: true },
);
