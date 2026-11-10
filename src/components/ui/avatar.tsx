"use client";

import { cn } from "cn";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { pickAvatarTint, readInitials } from "@/platform/design/avatar-identity";

const DEFAULT_AVATAR_SIZE_PX = 48;
const MINIMUM_INITIALS_SIZE_PX = 12;
const INITIALS_SIZE_RATIO = 0.36;

const TINT_CLASSES = {
  a: "bg-[var(--tint-a-bg)] text-[var(--tint-a-fg)]",
  b: "bg-[var(--tint-b-bg)] text-[var(--tint-b-fg)]",
  c: "bg-[var(--tint-c-bg)] text-[var(--tint-c-fg)]",
  d: "bg-[var(--tint-d-bg)] text-[var(--tint-d-fg)]",
  e: "bg-[var(--tint-e-bg)] text-[var(--tint-e-fg)]",
  f: "bg-[var(--tint-f-bg)] text-[var(--tint-f-fg)]",
};

type AvatarProps = {
  stableId: string;
  name: string;
  imageUrl?: string | null;
  sizePx?: number;
  className?: string;
};

export function Avatar({ stableId, name, imageUrl, sizePx = DEFAULT_AVATAR_SIZE_PX, className }: AvatarProps) {
  const fontSize = Math.max(MINIMUM_INITIALS_SIZE_PX, Math.round(sizePx * INITIALS_SIZE_RATIO));
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      aria-hidden="true"
      style={{ width: sizePx, height: sizePx, fontSize }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none font-bold tracking-[0.01em]",
        TINT_CLASSES[pickAvatarTint(stableId)],
        className,
      )}
    >
      {imageUrl ? <AvatarPrimitive.Image src={imageUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center">
        {readInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
