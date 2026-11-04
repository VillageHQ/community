import { cn } from "cn";
import Image from "next/image";

import { LOGO_BACKDROPS, type LogoBackdrop } from "@/lib/branding/logo-rules";
import { readInitials } from "@/lib/design/avatar-identity";

const DEFAULT_LOGO_SIZE_PX = 44;
const CORNER_RATIO = 0.3;
const INITIAL_SIZE_RATIO = 0.46;
const LOGO_PADDING_RATIO = 0.1;

const TILE_TONES = {
  accent: "bg-primary text-primary-foreground shadow-[inset_0_0_0_1.5px_var(--brand-edge)]",
  inverse: "bg-primary-foreground text-primary",
};

const LOGO_BACKDROP_CLASSES: Record<LogoBackdrop, string> = {
  [LOGO_BACKDROPS.light]: "bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]",
  [LOGO_BACKDROPS.dark]: "bg-[var(--logo-backdrop-dark)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]",
};

type LogoTileProps = {
  name: string;
  logo: { url: string; backdrop: LogoBackdrop } | null;
  sizePx?: number;
  tone?: keyof typeof TILE_TONES;
  className?: string;
};

export function LogoTile({ name, logo, sizePx = DEFAULT_LOGO_SIZE_PX, tone = "accent", className }: LogoTileProps) {
  const dimensions = { width: sizePx, height: sizePx, borderRadius: sizePx * CORNER_RATIO };
  if (logo) {
    return (
      <span
        data-slot="logo-tile"
        style={{ ...dimensions, padding: sizePx * LOGO_PADDING_RATIO }}
        className={cn("inline-flex shrink-0 items-center justify-center", LOGO_BACKDROP_CLASSES[logo.backdrop], className)}
      >
        <Image src={logo.url} alt="" width={sizePx} height={sizePx} unoptimized className="size-full object-contain" />
      </span>
    );
  }

  return (
    <span
      data-slot="logo-tile"
      aria-hidden="true"
      style={{ ...dimensions, fontSize: sizePx * INITIAL_SIZE_RATIO }}
      className={cn("inline-flex shrink-0 items-center justify-center leading-none font-bold", TILE_TONES[tone], className)}
    >
      {readInitials(name).slice(0, 1)}
    </span>
  );
}
