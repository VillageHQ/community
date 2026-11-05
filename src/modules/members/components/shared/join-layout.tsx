import type { ReactNode } from "react";

import { InviterNote } from "@/components/inviter-note";
import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { readFirstName } from "@/platform/design/avatar-identity";

import type { WelcomeContext } from "./welcome-context";

export function JoinLayout({ welcome, children }: { welcome: WelcomeContext; children: ReactNode }) {
  const { community, member, neighbours, inviter } = welcome;
  const firstName = readFirstName(member.name);
  return (
    <SplitLayout
      isTakeover
      copyAs="div"
      community={community}
      you={member}
      people={neighbours}
      note={
        inviter ? (
          <InviterNote inviter={inviter} communityName={community.name}>
            {firstName}, we saved you a seat. Glad you&apos;re here.
          </InviterNote>
        ) : (
          <CommunityNote community={community}>
            Glad you&apos;re here, {firstName}. This is where {community.name} members help each other meet the right
            people.
          </CommunityNote>
        )
      }
    >
      {children}
    </SplitLayout>
  );
}
