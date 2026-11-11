"use client";

import { UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NETWORK_STAGES, type NetworkStatus } from "@/modules/network/contract";

const STARTED_STAGES: ReadonlySet<NetworkStatus["stage"]> = new Set([NETWORK_STAGES.needsSync, NETWORK_STAGES.syncing]);

type ConnectInvitationProps = { stage: NetworkStatus["stage"]; onOpen: () => void };

// Shown with the search to a member who hasn't connected: an invitation, never a gate. Its button opens the same steps
// as before (LinkedIn, the sharing consent, the sync); nothing of theirs is shared until they agree there.
export function ConnectInvitation({ stage, onOpen }: ConnectInvitationProps) {
  const isStarted = STARTED_STAGES.has(stage);

  return (
    <section
      aria-labelledby="connect-invitation-title"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-card p-4 shadow-panel sm:p-5"
    >
      <UsersRound aria-hidden="true" className="size-6 shrink-0 text-brand-emphasis" />
      <div className="grid min-w-0 flex-[1_1_280px] gap-1">
        <h2 id="connect-invitation-title" className="type-h3">
          Add your network so others can reach people you know
        </h2>
        <p className="type-small text-foreground-soft">
          {isStarted
            ? "You agreed to share. Finish syncing and your searches cover the people you know too."
            : "You're searching the networks other members shared. Add yours and your searches cover the people you know too. Nothing of yours is shared until you agree."}
        </p>
      </div>
      <Button variant="soft" onClick={onOpen}>
        {isStarted ? "Finish syncing" : "Add your network"}
      </Button>
    </section>
  );
}
