import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import type { Post } from "@/lib/feed/feed-api";
import { ROUTES } from "@/lib/routes";

type Author = Post["author"];

export function AuthorName({ author, className }: { author: Author; className?: string }) {
  if (author.isBanned) return <span className={className}>{author.name}</span>;
  return (
    <Link href={`${ROUTES.members}/${author.id}`} className={`hover:underline ${className ?? ""}`}>
      {author.name}
    </Link>
  );
}

export function BannedTag({ author }: { author: Author }) {
  if (!author.isBanned) return null;
  return (
    <Tag tone="destructive" className="shrink-0">
      Banned
    </Tag>
  );
}
