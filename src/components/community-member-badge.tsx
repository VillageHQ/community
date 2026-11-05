import { UsersRound } from "lucide-react";

import { Tag } from "@/components/ui/tag";
import { COMMUNITY_MEMBER_LABEL } from "@/platform/text/labels";

export function CommunityMemberBadge() {
  return (
    <Tag tone="accent" className="font-bold">
      <UsersRound aria-hidden="true" />
      {COMMUNITY_MEMBER_LABEL}
    </Tag>
  );
}
