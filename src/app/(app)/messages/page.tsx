import { requireMember } from "@/platform/auth/session";

import { NoConversationSelected } from "@/modules/messages/components/no-conversation-selected";
import { messagesManifest } from "@/modules/messages/manifest";
import { modulePage } from "@/platform/modules/module-page";

export default modulePage(messagesManifest, async function MessagesPage() {
  await requireMember();
  return <NoConversationSelected />;
});
