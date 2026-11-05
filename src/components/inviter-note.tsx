import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";

type InviterNoteProps = {
  inviter: { id: string | null; name: string; title: string | null };
  communityName: string;
  children: ReactNode;
};

export function InviterNote({ inviter, communityName, children }: InviterNoteProps) {
  const role = inviter.title ? `${inviter.title}, ${communityName}` : communityName;
  return (
    <>
      <p className="type-lead">{children}</p>
      <figcaption className="mt-3.5 flex items-center gap-3">
        <Avatar stableId={inviter.id ?? inviter.name} name={inviter.name} sizePx={44} />
        <div className="min-w-0">
          <div className="type-label">{inviter.name}</div>
          <div className="type-micro font-medium text-muted-foreground">{role}</div>
        </div>
      </figcaption>
    </>
  );
}
