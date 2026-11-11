"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { BackLink } from "@/components/page-header";
import { describeThreadLine, NEW_THREAD_LINE } from "@/modules/messages/copy";
import { sendMessageRequest, startConversationRequest } from "@/modules/messages/queries";
import { ROUTES } from "@/platform/http/routes";

import { MessageComposer } from "./message-composer";

type NewThreadProps = { member: { id: string; name: string }; communityName: string };

// Founderhall's first message (`/messages/new?to=`): the thread page with no messages yet. The first Send starts the
// conversation and opens it in the Inbox, so nobody gets an empty conversation from a click on Message.
export function NewThread({ member, communityName }: NewThreadProps) {
  const router = useRouter();
  const send = useMutation({
    mutationFn: async (body: string) => {
      const { conversationId } = await startConversationRequest(member.id);
      await sendMessageRequest({ conversationId, clientKey: crypto.randomUUID(), body });
      return conversationId;
    },
    onSuccess: (conversationId) => router.replace(`${ROUTES.messages}/${conversationId}`),
  });

  return (
    <section aria-label={`New message to ${member.name}`}>
      <BackLink href={ROUTES.messages}>Inbox</BackLink>
      <div className="fh-pagehead">
        <h1 className="fh-h2">{member.name}</h1>
        <p className="fh-small fh-muted">{describeThreadLine(communityName)}</p>
      </div>
      <div className="fh-msgs">
        <p className="fh-small fh-muted">{NEW_THREAD_LINE}</p>
      </div>
      <MessageComposer peerName={member.name} isBusy={send.isPending || send.isSuccess} onSend={(body) => send.mutate(body)} />
      {send.error ? <FormError message={send.error.message} /> : null}
    </section>
  );
}
