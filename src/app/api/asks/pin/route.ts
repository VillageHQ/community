import { pinAskBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { setAskPinned } from "@/modules/asks/service";

export const POST = asksRoutes.member(
  "asks-pin",
  pinAskBodySchema,
  async (context, body) => {
    await setAskPinned(context, body);
    return Response.json({ message: body.isPinned ? "Pinned to the top of the board." : "Unpinned." });
  },
  { adminOnly: true },
);
