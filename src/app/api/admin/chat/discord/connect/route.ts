import { discordConnectBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { connectDiscord } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-discord-connect",
  discordConnectBodySchema,
  async (context, body) => {
    const { channelName } = await connectDiscord(context, body);
    return Response.json({ message: `Discord connected. New asks go to #${channelName}. Send a test post to check it.` });
  },
  { adminOnly: true },
);
