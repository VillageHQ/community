import { chatRoutes } from "@/modules/chat/routes";
import { getDatabase } from "@/platform/database/client";
import { answerSlackCommand } from "@/shell/slack-ask";

// Slack's /ask. Its signature replaces a session; with the module off this answers 404 like every chat route.
export const POST = chatRoutes.open("chat-slack-command", async (request: Request) => answerSlackCommand(getDatabase(), process.env, request));
