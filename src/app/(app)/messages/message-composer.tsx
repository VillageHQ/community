"use client";

import { SendHorizontal } from "lucide-react";
import { useState, type KeyboardEvent, type Ref } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { readFirstName } from "@/platform/design/avatar-identity";
import { MESSAGE_LIMITS, messageBodySchema } from "@/lib/messages/message-api";

const COUNTER_APPEARS_WITHIN = 200;
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

type MessageComposerProps = { peerName: string; inputRef: Ref<HTMLTextAreaElement>; onSend: (body: string) => void };

export function MessageComposer({ peerName, inputRef, onSend }: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const body = messageBodySchema.safeParse(draft);
  const charactersLeft = MESSAGE_LIMITS.bodyLength - draft.length;
  const isOverLimit = charactersLeft < 0;
  const placeholder = `Message ${readFirstName(peerName)}`;

  return (
    <form
      aria-label={`Reply to ${peerName}`}
      className="grid gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:px-6 lg:pt-4 lg:pb-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.success) return;
        onSend(body.data);
        setDraft("");
      }}
    >
      {isOverLimit ? <FormError message={`Keep your message under ${MESSAGE_LIMITS.bodyLength.toLocaleString("en-US")} characters.`} /> : null}
      <div className="flex items-end gap-2 rounded-[30px] bg-card p-1.5 pl-5 shadow-[inset_0_0_0_1.5px_var(--input)] transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_2px_var(--ring)]">
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={COMPOSER_HINT_ID}
          aria-invalid={isOverLimit}
          className="type-body my-auto max-h-36 min-h-6 min-w-0 flex-1 resize-none bg-transparent py-2 text-foreground outline-none [field-sizing:content]"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={sendOnEnter}
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Send"
          disabled={!body.success}
          onMouseDown={keepFocusInField}
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </div>
      <p id={COMPOSER_HINT_ID} className="sr-only">
        Enter sends. Shift and Enter adds a line.
      </p>
      {charactersLeft <= COUNTER_APPEARS_WITHIN ? (
        <p className="type-micro px-4 text-right font-medium text-muted-foreground">
          {isOverLimit ? `${-charactersLeft} over` : `${charactersLeft} left`}
        </p>
      ) : null}
    </form>
  );
}
