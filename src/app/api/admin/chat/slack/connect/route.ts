import { slackConnectBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { connectSlack } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-slack-connect",
  slackConnectBodySchema,
  async (context, body) => {
    const { accountName } = await connectSlack(context, body);
    return Response.json({ message: `Slack connected to ${accountName}. Pick the channel to post to.` });
  },
  { adminOnly: true },
);
