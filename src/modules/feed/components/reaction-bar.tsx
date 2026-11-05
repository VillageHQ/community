"use client";

import { cn } from "cn";
import { SmilePlus } from "lucide-react";
import { Popover } from "radix-ui";
import { useState, type ReactNode } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import type { Post, Reaction, ReactionCount } from "@/modules/feed/contract";

import { REACTION_DISPLAY, REACTION_ORDER, SURFACE_TONE_CLASSES, type SurfaceTone } from "./feed-display";
import { useSetReaction } from "./use-feed-mutations";

function readChipClasses(tone: SurfaceTone) {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-full pr-4 pl-3.5 text-[15px] leading-5 font-bold text-foreground-soft transition-[box-shadow,color,background-color] duration-150 hover:text-foreground hover:shadow-[inset_0_0_0_1.5px_var(--input)] active:translate-y-px aria-pressed:bg-accent aria-pressed:text-brand-emphasis aria-pressed:shadow-[inset_0_0_0_1.5px_var(--brand-emphasis)]",
    SURFACE_TONE_CLASSES[tone],
  );
}

function findReaction(reactions: ReactionCount[], reaction: Reaction) {
  return reactions.find((entry) => entry.reaction === reaction);
}

function toToggle(post: Post, reaction: Reaction) {
  return { postId: post.id, reaction, isActive: !findReaction(post.reactions, reaction)?.isMine };
}

type ReactionChipProps = { reaction: Reaction; entry: ReactionCount | undefined; tone: SurfaceTone; onToggle: () => void };

function ReactionChip({ reaction, entry, tone, onToggle }: ReactionChipProps) {
  const { label, icon: Icon } = REACTION_DISPLAY[reaction];
  const count = entry?.count ?? 0;
  const isMine = entry?.isMine ?? false;
  return (
    <button type="button" aria-pressed={isMine} aria-label={`${label}, ${count}`} className={readChipClasses(tone)} onClick={onToggle}>
      <Icon aria-hidden="true" className={cn("size-[19px]", isMine && "fill-current")} />
      <span className="min-w-2 text-center">{count}</span>
    </button>
  );
}

type ReactionPickerProps = { reactions: ReactionCount[]; onPick: (reaction: Reaction) => void };

function ReactionPicker({ reactions, onPick }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button type="button" variant="quiet" size="icon" aria-label="Add reaction" className="first:-ml-2">
          <SmilePlus aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align="start"
        sideOffset={6}
        aria-label="Choose a reaction"
        className="z-30 flex gap-1.5 rounded-full bg-popover p-2 shadow-panel data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        {REACTION_ORDER.map((reaction) => {
          const { label, icon: Icon } = REACTION_DISPLAY[reaction];
          const isMine = findReaction(reactions, reaction)?.isMine ?? false;
          return (
            <button
              key={reaction}
              type="button"
              aria-label={label}
              aria-pressed={isMine}
              className="flex size-12 items-center justify-center rounded-full text-foreground-soft hover:bg-muted hover:text-foreground aria-pressed:bg-accent aria-pressed:text-brand-emphasis"
              onClick={() => {
                setIsOpen(false);
                onPick(reaction);
              }}
            >
              <Icon aria-hidden="true" className={cn("size-icon", isMine && "fill-current")} />
            </button>
          );
        })}
      </Popover.Content>
    </Popover.Root>
  );
}

type ReactionBarProps = { post: Post; tone: SurfaceTone; children: ReactNode };

export function ReactionBar({ post, tone, children }: ReactionBarProps) {
  const setReaction = useSetReaction(post.id);
  const [touchedReactions, setTouchedReactions] = useState<readonly Reaction[]>([]);
  const shownReactions = REACTION_ORDER.filter(
    (reaction) => findReaction(post.reactions, reaction) || touchedReactions.includes(reaction),
  );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {shownReactions.map((reaction) => (
          <ReactionChip
            key={reaction}
            reaction={reaction}
            entry={findReaction(post.reactions, reaction)}
            tone={tone}
            onToggle={() => {
              setTouchedReactions((touched) => [...touched, reaction]);
              setReaction.mutate(toToggle(post, reaction));
            }}
          />
        ))}
        {shownReactions.length < REACTION_ORDER.length ? (
          <ReactionPicker
            reactions={post.reactions}
            onPick={(reaction) => {
              setTouchedReactions((touched) => [...touched, reaction]);
              setReaction.mutate(toToggle(post, reaction));
            }}
          />
        ) : null}
        <div className="ml-auto">{children}</div>
      </div>
      {setReaction.isError ? (
        <div className="mt-3">
          <FormError message={`That reaction didn't save. ${setReaction.error.message}`} />
        </div>
      ) : null}
    </>
  );
}
