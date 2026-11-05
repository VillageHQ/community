import { z } from "zod";

import { verifyAndSaveVillageKeys } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const keysBodySchema = z.object({
  publicKey: z.string().trim().min(1, "Enter the public key."),
  secretKey: z.string().trim().min(1, "Enter the secret key."),
});

export const POST = networkRoutes.member(
  "village-keys",
  keysBodySchema,
  async (context, body) => {
    await verifyAndSaveVillageKeys(context, body);
    return Response.json({ message: "Village keys saved." });
  },
  { adminOnly: true },
);
