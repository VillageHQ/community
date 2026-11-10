import { chatKindBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { composeTestPost } from "@/modules/chat/rules";
import { sendTestPost } from "@/modules/chat/service";
import { readBranding } from "@/platform/branding/branding";
import { resolveAppUrl } from "@/platform/http/app-url";

export const POST = chatRoutes.member(
  "admin-chat-test",
  chatKindBodySchema,
  async (context, { kind }) => {
    const { name } = await readBranding(context.database);
    await sendTestPost(context, kind, composeTestPost(kind, { community: name, url: resolveAppUrl(context.environment) }));
    return Response.json({ message: "Test post sent. Look for it in the channel." });
  },
  { adminOnly: true },
);
