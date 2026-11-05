import { requireMember } from "@/platform/auth/session";

import { NoConversationSelected } from "./no-conversation-selected";

export default async function MessagesPage() {
  await requireMember();
  return <NoConversationSelected />;
}
