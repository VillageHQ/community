import { slackChannelBodySchema } from "@/modules/chat/contract";
import { chatRoutes } from "@/modules/chat/routes";
import { chooseSlackChannel } from "@/modules/chat/service";

export const POST = chatRoutes.member(
  "admin-chat-slack-channel",
  slackChannelBodySchema,
  async (context, { channelId }) => {
    await chooseSlackChannel(context, channelId);
    return Response.json({ message: "Channel saved. Send a test post to check it." });
  },
  { adminOnly: true },
);
