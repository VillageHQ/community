import { requireMember } from "@/lib/session";

import { NoConversationSelected } from "./no-conversation-selected";

export default async function MessagesPage() {
  await requireMember();
  return <NoConversationSelected />;
}
