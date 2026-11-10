import { cn } from "cn";

// The AGPL asks a network service to offer its source to the people who use it.
// A copy with changes should point NEXT_PUBLIC_SOURCE_CODE_URL at its own source.
export const SOURCE_CODE_URL =
  process.env.NEXT_PUBLIC_SOURCE_CODE_URL || "https://github.com/VillageHQ/community";

export function SourceCodeLink() {
  return (
    <a
      href={SOURCE_CODE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      Source code (AGPL-3.0)
    </a>
  );
}

// The foot of every page, phones included: the fund's name and the way to the source.
export function SiteFooter({ name, className }: { name: string; className?: string }) {
  return (
    <footer
      data-slot="site-footer"
      className={cn("type-micro flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1 pt-8 pb-2 text-center font-normal text-muted-foreground", className)}
    >
      {name ? (
        <>
          <span>{name}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <SourceCodeLink />
    </footer>
  );
}
