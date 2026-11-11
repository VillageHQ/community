import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/page-header";
import { ROUTES } from "@/platform/http/routes";

export default function ConversationNotFound() {
  return (
    <>
      <BackLink href={ROUTES.messages}>Inbox</BackLink>
      <EmptyState title="This conversation isn’t available" description="The link may be old, or it may belong to someone else’s conversation." />
    </>
  );
}
