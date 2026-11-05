import { MessageCircleOff } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/platform/http/routes";

import { PhoneMessagesHeading } from "@/app/(app)/messages/phone-messages-heading";

export default function ConversationNotFound() {
  return (
    <div className="flex h-full items-center justify-center bg-card max-lg:rounded-card-phone max-lg:shadow-panel">
      <PhoneMessagesHeading />
      <EmptyState
        icon={MessageCircleOff}
        headingLevel="h2"
        title="This conversation isn't available"
        description="The link may be old, or it may belong to someone else's conversation."
      >
        <Button asChild size="lg">
          <Link href={ROUTES.messages}>Back to messages</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
