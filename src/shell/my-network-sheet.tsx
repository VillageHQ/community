"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SetRow } from "@/components/ui/rows";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/platform/text/format-date";
import { toMembersOf, toPossessive } from "@/modules/members/rules-words";

// The honest network line (Founderhall's NETWORK_LINE). Never "they never see your contacts".
export const NETWORK_LINE =
  "Members who search can see that you know a person and ask you for an intro. They can’t download your contacts, see how you know them beyond a warmth word, or reach anyone without your yes.";

export type MyNetworkState =
  | { kind: "off" }
  | { kind: "not_connected" }
  | { kind: "connected"; connectedAt: string; isSharing: boolean; hasAgreed: boolean };

function stopSharing() {
  return postRequest(API_ROUTES.networkLeave, { confirmed: true }, acknowledgedResponseSchema);
}

// Founderhall's "My network" sheet on My profile (views networkPanel).
export function MyNetworkSheet({ state, communityName }: { state: MyNetworkState; communityName: string }) {
  const router = useRouter();
  const flash = useFlash();
  const leave = useMutation({
    mutationFn: stopSharing,
    onSuccess: () => {
      flash("Sharing is off. Your paths are gone from other members’ searches.");
      router.refresh();
    },
  });

  if (state.kind === "off") {
    return (
      <section className="fh-sheet" id="network" aria-labelledby="network-title">
        <h2 id="network-title" className="fh-h3">
          My network
        </h2>
        <p className="mt-2">
          <Pill tone="open">Not connected</Pill>
        </p>
        <p className="fh-small mt-2.5">Connecting your network lets search find warm paths through the people you know and {toPossessive(communityName)}.</p>
        <p className="fh-small fh-muted mt-2">{NETWORK_LINE}</p>
        <div className="fh-btn-row mt-3">
          <Button type="button" variant="secondary" size="sm" disabled>
            Connect my network
          </Button>
        </div>
        <p className="fh-hint">Not available yet: {communityName} hasn’t switched on network search.</p>
      </section>
    );
  }

  if (state.kind === "not_connected") {
    return (
      <section className="fh-sheet" id="network" aria-labelledby="network-title">
        <h2 id="network-title" className="fh-h3">
          My network
        </h2>
        <p className="mt-2">
          <Pill tone="open">Not connected</Pill>
        </p>
        <p className="fh-small mt-2.5">
          Let {toMembersOf(communityName)} find who you know, and find warm paths through your own network in the same search. Nobody is introduced without saying yes.
        </p>
        <div className="fh-btn-row mt-3">
          <Button asChild variant="primary" size="sm">
            <Link href={ROUTES.myNetwork}>Connect my network</Link>
          </Button>
        </div>
      </section>
    );
  }

  const { connectedAt, isSharing, hasAgreed } = state;
  return (
    <section className="fh-sheet" id="network" aria-labelledby="network-title">
      <h2 id="network-title" className="fh-h3">
        My network
      </h2>
      <p className="mt-2">
        <Pill tone="made">Connected {formatDayMonth(connectedAt)}</Pill>
      </p>
      <p className="fh-small mt-2.5">
        Your searches include the people you know{isSharing ? `, and ${communityName} members can ask you for intros to them` : ""}.
      </p>
      <div className="mt-3">
        <SetRow
          label={`Share with ${communityName}`}
          hint={isSharing ? "On: members see that you can introduce them, and ask." : hasAgreed ? "Joining the community group…" : "Off: your network powers only your own searches."}
          control={
            isSharing ? (
              <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" disabled={leave.isPending} onClick={() => leave.mutate()}>
                Stop sharing
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm" className="whitespace-nowrap">
                <Link href={ROUTES.network}>Share</Link>
              </Button>
            )
          }
        />
      </div>
      <FormError message={leave.error?.message ?? null} />
      <p className="fh-small fh-muted mt-2">{NETWORK_LINE}</p>
      <div className="fh-btn-row mt-3">
        <Button asChild variant="quiet" size="sm">
          <Link href={ROUTES.myNetwork}>Disconnect</Link>
        </Button>
      </div>
    </section>
  );
}
