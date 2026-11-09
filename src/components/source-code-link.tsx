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
      className="type-micro text-muted-foreground underline underline-offset-2 hover:text-foreground"
    >
      Source code (AGPL-3.0)
    </a>
  );
}
