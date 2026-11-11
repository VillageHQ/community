"use client";

import { Send } from "lucide-react";
import { useState, type KeyboardEvent, type Ref } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { MESSAGE_LIMITS, messageBodySchema } from "@/modules/messages/contract";
import { COMPOSER_LABEL } from "@/modules/messages/copy";

const COUNTER_APPEARS_WITHIN = 200;
const COMPOSER_ID = "reply";
const COMPOSER_HINT_ID = "message-composer-hint";
const FINE_POINTER_QUERY = "(pointer: fine)";

function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function keepFocusInField(event: { preventDefault: () => void }) {
  event.preventDefault();
}

type MessageComposerProps = { peerName: string; inputRef?: Ref<HTMLTextAreaElement>; isBusy?: boolean; onSend: (body: string) => void };

// Founderhall's reply box (`.reply`): one Leaf bar under the messages, a textarea "Write a message" and Send.
// Send stays ready, as Founderhall's; a blank or too-long message sends nothing.
export function MessageComposer({ peerName, inputRef, isBusy = false, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const body = messageBodySchema.safeParse(draft);
  const charactersLeft = MESSAGE_LIMITS.bodyLength - draft.length;
  const isOverLimit = charactersLeft < 0;

  return (
    <>
      <form
        aria-label={`Reply to ${peerName}`}
        className="fh-reply"
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.success || isBusy) return;
          onSend(body.data);
          setDraft("");
        }}
      >
        <label htmlFor={COMPOSER_ID} className="sr-only">
          {COMPOSER_LABEL}
        </label>
        <textarea
          id={COMPOSER_ID}
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={COMPOSER_LABEL}
          aria-describedby={COMPOSER_HINT_ID}
          aria-invalid={isOverLimit}
          className="fh-input min-w-0 flex-1 resize-y"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={sendOnEnter}
        />
        <Button type="submit" size="sm" className="self-start" disabled={isBusy} aria-busy={isBusy} onMouseDown={keepFocusInField}>
          <Send aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
          Send
        </Button>
      </form>
      <p id={COMPOSER_HINT_ID} className="sr-only">
        Enter sends. Shift and Enter adds a line.
      </p>
      {isOverLimit ? <FormError message={`Keep your message under ${MESSAGE_LIMITS.bodyLength.toLocaleString("en-US")} characters.`} /> : null}
      {charactersLeft <= COUNTER_APPEARS_WITHIN ? (
        <p className="fh-hint text-right">{isOverLimit ? `${-charactersLeft} over` : `${charactersLeft} left`}</p>
      ) : null}
    </>
  );
}
