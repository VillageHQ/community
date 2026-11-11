import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/platform/design/avatar-identity";
import { ROUTES } from "@/platform/http/routes";

type MemberReachCardProps = { memberName: string; communityName: string; sharesNetwork: boolean };

// "Who <name> can introduce you to", on a member's profile while search is on. Village never hands over a member's
// contacts, so this says whether search goes through them and offers the search. It never lists anyone.
export function MemberReachCard({ memberName, communityName, sharesNetwork }: MemberReachCardProps) {
  const first = readFirstName(memberName);
  return (
    <Card>
      <CardTitle>Who {first} can introduce you to</CardTitle>
      {sharesNetwork ? (
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
        <p className="type-lead mt-2 text-foreground-soft">
          {first} hasn&apos;t shared a network yet, so search finds no paths through them. You can still ask {first} for an intro to someone you name.
        </p>
      )}
    </Card>
  );
}
