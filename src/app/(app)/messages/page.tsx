import { requireMember } from "@/platform/auth/session";

import { NoConversationSelected } from "@/modules/messages/components/no-conversation-selected";

export default async function MessagesPage() {
  await requireMember();
  return <NoConversationSelected />;
}
