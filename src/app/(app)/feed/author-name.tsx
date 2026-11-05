import Link from "next/link";

import { Tag } from "@/components/ui/tag";
import type { Post } from "@/lib/feed/feed-api";
import { ROUTES } from "@/platform/http/routes";

type Author = Post["author"];

export function AuthorName({ author, className }: { author: Author; className?: string }) {
  if (author.isBanned) return <span className={className}>{author.name}</span>;
  return (
    <Link href={`${ROUTES.members}/${author.id}`} className={`hover:underline ${className ?? ""}`}>
      {author.name}
    </Link>
  );
}

export function readRemovedAuthorLabel(isViewerAdmin: boolean) {
  return isViewerAdmin ? "Banned" : "No longer a member";
}

export function BannedTag({ author, isViewerAdmin }: { author: Author; isViewerAdmin: boolean }) {
  if (!author.isBanned) return null;
  return (
    <Tag tone={isViewerAdmin ? "destructive" : "neutral"} className="shrink-0">
      {readRemovedAuthorLabel(isViewerAdmin)}
    </Tag>
  );
}
