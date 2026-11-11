import { cn } from "cn";
import Image from "next/image";
import Link from "next/link";

import { LOGO_BACKDROPS, type LogoBackdrop } from "@/platform/branding/logo-rules";
import { readInitials } from "@/platform/design/avatar-identity";

// Founderhall's fund logo (crops fund-mark-monogram.png, fund-mark-large.png): 30 px (34 in the sidebar, 44 on
// public pages), radius 7 (10 when large); without a logo, a monogram tile in the fund colour with Leaf initials.
const DEFAULT_LOGO_SIZE_PX = 30;
const LARGE_FROM_PX = 40;
const SMALL_RADIUS_PX = 7;
const LARGE_RADIUS_PX = 10;
const INITIALS_SIZE_RATIO = 0.4;

const TILE_TONES = {
  accent: "bg-fund text-leaf",
  inverse: "bg-leaf text-fund",
};

const LOGO_BACKDROP_CLASSES: Record<LogoBackdrop, string> = {
  [LOGO_BACKDROPS.light]: "",
  [LOGO_BACKDROPS.dark]: "bg-[var(--logo-backdrop-dark)] p-[10%]",
};

type LogoTileProps = {
  name: string;
  logo: { url: string; backdrop: LogoBackdrop } | null;
  sizePx?: number;
  tone?: keyof typeof TILE_TONES;
  className?: string;
};

export function LogoTile({ name, logo, sizePx = DEFAULT_LOGO_SIZE_PX, tone = "accent", className }: LogoTileProps) {
  const dimensions = { width: sizePx, height: sizePx, borderRadius: sizePx >= LARGE_FROM_PX ? LARGE_RADIUS_PX : SMALL_RADIUS_PX };
  if (logo) {
    return (
      <span data-slot="logo-tile" style={dimensions} className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", LOGO_BACKDROP_CLASSES[logo.backdrop], className)}>
        <Image src={logo.url} alt="" width={sizePx} height={sizePx} unoptimized className="size-full object-contain" />
      </span>
    );
  }

  return (
    <span
      data-slot="logo-tile"
      aria-hidden="true"
      style={{ ...dimensions, fontSize: Math.round(sizePx * INITIALS_SIZE_RATIO) }}
      className={cn("inline-grid shrink-0 place-items-center font-sans leading-none font-semibold tracking-[0.02em]", TILE_TONES[tone], className)}
    >
      {readInitials(name)}
    </span>
  );
}

type FundMarkProps = {
  name: string;
  logo: LogoTileProps["logo"];
  // "Members", "Admin console" or "Founder view"; none on public pages.
  sub?: string;
  href?: string;
  size?: "default" | "sidebar" | "public";
  className?: string;
};

const FUND_MARK_LOGO_SIZES = { default: 30, sidebar: 34, public: 44 };

// The fund's mark: logo, name and the small line under it. It leads every screen; the product name never does.
export function FundMark({ name, logo, sub, href, size = "default", className }: FundMarkProps) {
  const body = (
    <>
      <LogoTile name={name} logo={logo} sizePx={FUND_MARK_LOGO_SIZES[size]} />
      {size === "public" ? (
        <b>{name}</b>
      ) : (
        <span className="min-w-0">
          <b title={name} className="block truncate">
            {name}
          </b>
          {sub ? <small>{sub}</small> : null}
        </span>
      )}
    </>
  );
  if (size === "public") return <div className={cn("fh-pub-mark", className)}>{body}</div>;
  return href ? (
    <Link href={href} className={cn("fh-fundmark", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn("fh-fundmark", className)}>{body}</div>
  );
}
