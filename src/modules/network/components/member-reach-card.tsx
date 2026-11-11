import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

type MemberReachCardProps = {
  memberName: string;
  communityName: string;
  reach: { isIntroducer: boolean; sharesNetwork: boolean };
  // The profile shows "Ask <name> for an intro" (intros on, no block, they take asks).
  canAsk: boolean;
};

function readNoPathsLine(first: string, { isIntroducer }: MemberReachCardProps["reach"], canAsk: boolean) {
  if (!isIntroducer) return `In this community, intros go through members the admins chose, and ${first} isn't one of them.`;
  const noPaths = `${first} hasn't shared a network yet, so search finds no paths through them.`;
  return canAsk ? `${noPaths} You can still ask ${first} for an intro to someone you name.` : noPaths;
}

// "Who <name> can introduce you to", on a member's profile while search is on. Village never hands over a member's
// contacts, so this says whether search goes through them and offers the search. It never lists anyone.
export function MemberReachCard({ memberName, communityName, reach, canAsk }: MemberReachCardProps) {
  const first = readFirstName(memberName);
  return (
    <Card>
      <CardTitle>Who {first} can introduce you to</CardTitle>
      {reach.sharesNetwork ? (
        <>
          <p className="type-lead mt-2 text-foreground-soft">
            {first}&apos;s network is shared with {communityName}. Search for the person you need: when {first} knows them, the path shows &ldquo;via {memberName}&rdquo;.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={ROUTES.network}>
                <Search aria-hidden="true" />
                Search
              </Link>
            </Button>
          </div>
          <p className="type-small mt-3 text-muted-foreground">You see that {first} knows a person, never the contact list. Nobody is introduced without saying yes.</p>
        </>
      ) : (
        <p className="type-lead mt-2 text-foreground-soft">{readNoPathsLine(first, reach, canAsk)}</p>
      )}
    </Card>
  );
}
