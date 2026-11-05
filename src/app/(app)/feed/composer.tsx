"use client";

import { cn } from "cn";
import { Plus, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/textarea";
import { FEED_LIMITS, POST_TYPES, type PostType } from "@/lib/feed/feed-api";

import { CHOOSABLE_POST_TYPES, FEED_AVATAR_SIZES, POST_TYPE_DISPLAY } from "./feed-display";
import { useFeedContext } from "./feed-context";
import { useCreatePost } from "./use-feed-mutations";

const COUNTER_APPEARS_WITHIN = 200;
const COMPOSER_PLACEHOLDER = "Ask the room, share a win, offer a hand";
const POSTED_ANNOUNCEMENT = "Your post is live.";
const FIRST_POST_FIELD_IDS = { inline: "composer-inline", sheet: "composer-sheet" } as const;

export const INLINE_COMPOSER_INPUT_ID = FIRST_POST_FIELD_IDS.inline;

export function submitOnCommandEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

export function submitWithoutReload(event: FormEvent<HTMLFormElement>, submit: () => void) {
  event.preventDefault();
  submit();
}

type PostTypeChipsProps = { type: PostType; onChange: (type: PostType) => void };

export function PostTypeChips({ type, onChange }: PostTypeChipsProps) {
  return (
    <div role="group" aria-label="Post type" className="flex flex-wrap gap-2">
      {CHOOSABLE_POST_TYPES.map((choice) => {
        const { label, icon: Icon } = POST_TYPE_DISPLAY[choice];
        return (
          <Chip
            key={choice}
            isPressed={type === choice}
            className="bg-muted shadow-none"
            onClick={() => onChange(type === choice ? POST_TYPES.plain : choice)}
          >
            <Icon aria-hidden="true" className="size-icon-small" />
            {label}
          </Chip>
        );
      })}
    </div>
  );
}

type LengthCounterProps = { length: number; maximumLength: number };

export function LengthCounter({ length, maximumLength }: LengthCounterProps) {
  const remaining = maximumLength - length;
  if (remaining > COUNTER_APPEARS_WITHIN) return null;
  return (
    <p role="status" className={cn("type-micro text-muted-foreground", remaining < 0 && "font-bold text-destructive-text")}>
      {remaining < 0 ? `${Math.abs(remaining)} over the limit` : `${remaining} left`}
    </p>
  );
}

type ComposerProps = { inputId: string; onPosted?: () => void };

export function Composer({ inputId, onPosted }: ComposerProps) {
  const { viewer, announce } = useFeedContext();
  const [body, setBody] = useState("");
  const [type, setType] = useState<PostType>(POST_TYPES.plain);
  const createPost = useCreatePost();

  return (
    <form
      aria-label="New post"
      onSubmit={(event) =>
        submitWithoutReload(event, () =>
          createPost.mutate(
            { body, type },
            {
              onSuccess: () => {
                setBody("");
                setType(POST_TYPES.plain);
                announce(POSTED_ANNOUNCEMENT);
                onPosted?.();
              },
            },
          ),
        )
      }
    >
      <div className="flex items-start gap-3.5">
        <Avatar stableId={viewer.id} name={viewer.name} imageUrl={viewer.avatarUrl} sizePx={FEED_AVATAR_SIZES.composer} className="max-sm:hidden" />
        <Textarea
          id={inputId}
          rows={1}
          value={body}
          aria-label="Write a post"
          aria-invalid={createPost.isError}
          placeholder={COMPOSER_PLACEHOLDER}
          className="type-lead max-h-80 min-h-14 resize-none bg-muted shadow-none field-sizing-content focus:shadow-none"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={submitOnCommandEnter}
        />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 sm:pl-[62px]">
        <PostTypeChips type={type} onChange={setType} />
        <div className="flex items-center gap-3 max-sm:ml-auto">
          <LengthCounter length={body.length} maximumLength={FEED_LIMITS.postLength} />
          <Button type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
      {createPost.isError ? (
        <div className="mt-3.5 sm:pl-[62px]">
          <FormError message={createPost.error.message} />
        </div>
      ) : null}
    </form>
  );
}

type ComposerSheetProps = { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; isTriggerShown: boolean };

export function ComposerSheet({ isOpen, onOpenChange, isTriggerShown }: ComposerSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      {isTriggerShown ? (
        <Dialog.Trigger asChild>
          <Button type="button" size="lg" className="fixed right-4 bottom-[104px] z-20 lg:hidden">
            <Plus aria-hidden="true" />
            Post
          </Button>
        </Dialog.Trigger>
      ) : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-[rgb(10_12_10/0.48)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] bg-card px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),24px)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-input" />
          <div className="mb-3 flex items-center justify-between gap-3 pl-2">
            <Dialog.Title className="type-h3">New post</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="quiet" size="icon" aria-label="Close new post">
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Composer inputId={FIRST_POST_FIELD_IDS.sheet} onPosted={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
