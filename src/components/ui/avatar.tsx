import { cn } from "cn";

import { pickAvatarTint, readInitials } from "@/platform/design/avatar-identity";

// Founderhall's avatar (design-system.md §3.4): round; a photo when there is one, else two serif initials on one of
// four muted tints picked by the member's id. Sizes: 28 (sm), 36 (default), 64 (lg), 80 (xl); any other size scales.
// The photo is a plain <img> in the page, over the initials (as on Founderhall): it shows on first paint, in print and
// without scripts, and a picture that fails to load leaves the initials showing through (alt="" draws nothing).
const DEFAULT_AVATAR_SIZE_PX = 36;
const FOUNDERHALL_FONT_SIZES: Record<number, number> = { 28: 12, 36: 14, 64: 24, 80: 30 };
const INITIALS_SIZE_RATIO = 0.39;
const MINIMUM_INITIALS_SIZE_PX = 11;

const TINT_CLASSES = { t1: "bg-[var(--tint-a-bg)]", t2: "bg-[var(--tint-b-bg)]", t3: "bg-[var(--tint-c-bg)]", t4: "bg-[var(--tint-d-bg)]" };

type AvatarProps = {
  stableId: string;
  name: string;
  imageUrl?: string | null;
  sizePx?: number;
  // An outside person (not a member): Leaf with a Graphite ring.
  isOutside?: boolean;
  className?: string;
};

function readFontSize(sizePx: number) {
  return FOUNDERHALL_FONT_SIZES[sizePx] ?? Math.max(MINIMUM_INITIALS_SIZE_PX, Math.round(sizePx * INITIALS_SIZE_RATIO));
}

export function Avatar({ stableId, name, imageUrl, sizePx = DEFAULT_AVATAR_SIZE_PX, isOutside = false, className }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      aria-hidden="true"
      style={{ width: sizePx, height: sizePx, fontSize: readFontSize(sizePx) }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif leading-none font-semibold tracking-[0.01em] text-ink",
        isOutside ? "bg-leaf shadow-[inset_0_0_0_1px_var(--graphite)]" : TINT_CLASSES[pickAvatarTint(stableId)],
        className,
      )}
    >
      <span className="flex size-full items-center justify-center">{readInitials(name)}</span>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- outside faces of any host and size, drawn as they are
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}

// Overlapping 28 px faces with a 2 px ring (the helpers strip).
export function AvatarStack({ people }: { people: { id: string; name: string; imageUrl?: string | null }[] }) {
  return (
    <span className="flex shrink-0">
      {people.map((person) => (
        <Avatar
          key={person.id}
          stableId={person.id}
          name={person.name}
          imageUrl={person.imageUrl}
          sizePx={28}
          className="-mr-1.5 shadow-[0_0_0_2px_var(--fund-tint)]"
        />
      ))}
      <span className="sr-only">{people.map(({ name }) => name).join(", ")}</span>
    </span>
  );
}
