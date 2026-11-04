import { COMMUNITY_MEMBER_LABEL } from "@/lib/village/member-paths";

export function CommunityMemberBadge() {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {COMMUNITY_MEMBER_LABEL}
    </span>
  );
}
