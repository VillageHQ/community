import type { ReactNode } from "react";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { readFirstName } from "@/lib/design/avatar-identity";

import type { WelcomeContext } from "./welcome-context";

export function JoinLayout({ welcome, children }: { welcome: WelcomeContext; children: ReactNode }) {
  const { community, member, neighbours } = welcome;
  return (
    <SplitLayout
      isTakeover
      copyAs="div"
      community={community}
      you={member}
      people={neighbours}
      note={
        <CommunityNote community={community}>
          Glad you&apos;re here, {readFirstName(member.name)}. This is where {community.name} members help each other
          meet the right people.
        </CommunityNote>
      }
    >
      {children}
    </SplitLayout>
  );
}
