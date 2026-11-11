import { CircleAlert, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { requireAdmin } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";
import { isConnectedStatus, MEMBER_CHECK_OUTCOMES, VILLAGE_CHECK_GROUP, VILLAGE_CHECK_KEYS } from "@/modules/network/contract-village-check";
import { VillageCheckButton } from "@/modules/network/components/village-check-button";
import { networkManifest } from "@/modules/network/manifest";
import { readVillageCheck, type VillageCheckRead } from "@/modules/network/reads-village-check";
import { AdminSection } from "@/shell/admin-section";
import { SETUP_STEPS } from "@/shell/admin-setup-steps";

type Check = NonNullable<VillageCheckRead["check"]>;
type CheckedMember = VillageCheckRead["members"][number];

const KEY_LINES: Record<string, { text: string; isOk: boolean }> = {
  [VILLAGE_CHECK_KEYS.ok]: { text: "Keys valid: Village knows this app and its public key matches.", isOk: true },
  [VILLAGE_CHECK_KEYS.rejected]: { text: "Keys rejected: Village refused the secret key.", isOk: false },
  [VILLAGE_CHECK_KEYS.mismatched]: { text: "Keys don't match: the public key belongs to another Village app.", isOk: false },
  [VILLAGE_CHECK_KEYS.missing]: { text: "No keys yet: add your Village keys first.", isOk: false },
  [VILLAGE_CHECK_KEYS.unreachable]: { text: "Village didn't answer, so the keys couldn't be checked.", isOk: false },
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function readGroupLine({ group, groupMemberCount }: Check) {
  if (group === VILLAGE_CHECK_GROUP.found) return { text: `The community group exists, with ${plural(groupMemberCount ?? 0, "member", "members")} in it.`, isOk: true };
  if (group === VILLAGE_CHECK_GROUP.missing) return { text: "The community group wasn't found: no member Village was asked about is in it.", isOk: false };
  if (group === VILLAGE_CHECK_GROUP.none) return { text: "No community group yet. Create it in Setup.", isOk: false };
  return null;
}

function Line({ text, isOk }: { text: string; isOk: boolean }) {
  const Icon = isOk ? CircleCheck : CircleAlert;
  return (
    <p className={`flex items-start gap-2 ${isOk ? "" : "font-semibold text-destructive-text"}`}>
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${isOk ? "text-sage-text" : ""}`} />
      {text}
    </p>
  );
}

function Summary({ check, members }: { check: Check; members: CheckedMember[] }) {
  const keyLine = KEY_LINES[check.keys ?? VILLAGE_CHECK_KEYS.unreachable] ?? KEY_LINES[VILLAGE_CHECK_KEYS.unreachable];
  const groupLine = readGroupLine(check);
  const asked = members.filter(({ outcome }) => outcome === MEMBER_CHECK_OUTCOMES.checked);
  const connected = asked.filter(({ isProvisioned, networkStatus }) => isProvisioned && isConnectedStatus(networkStatus)).length;
  return (
    <Card className="grid gap-3">
      <CardTitle>What Village said</CardTitle>
      {keyLine ? <Line {...keyLine} /> : null}
      {check.keys !== VILLAGE_CHECK_KEYS.ok && check.keys !== VILLAGE_CHECK_KEYS.unreachable ? (
        <p className="type-small">
          <Link href={`${ROUTES.adminSettings}?step=${SETUP_STEPS.keys}`} className="font-bold underline underline-offset-4">
            Fix the keys in Settings
          </Link>
        </p>
      ) : null}
      {groupLine ? <Line {...groupLine} /> : null}
      {check.keys === VILLAGE_CHECK_KEYS.ok ? <Line text={`${plural(connected, "member has", "members have")} connected their network, of ${members.length}.`} isOk={connected === members.length} /> : null}
      <CardDescription>Checked {formatDateAndTimeUtc(check.checkedAt ?? check.startedAt)}. This check uses no Village credits.</CardDescription>
    </Card>
  );
}

function StateTag({ isOk, children }: { isOk: boolean | null; children: ReactNode }) {
  return (
    <Tag tone={isOk === null ? "neutral" : isOk ? "sage" : "gold"} className={isOk === null ? "bg-card" : undefined}>
      {children}
    </Tag>
  );
}

function readNetworkTag(networkStatus: string | null) {
  if (networkStatus === "ready") return { text: "Connected", isOk: true };
  if (networkStatus === "needs_attention") return { text: "Connected, needs to reconnect", isOk: true };
  if (networkStatus === "syncing") return { text: "Syncing", isOk: false };
  return { text: "Not connected", isOk: false };
}

function MemberTags({ member }: { member: CheckedMember }) {
  if (member.outcome === MEMBER_CHECK_OUTCOMES.notStarted) return <StateTag isOk={null}>Hasn&apos;t started connecting, so Village wasn&apos;t asked</StateTag>;
  if (member.outcome === MEMBER_CHECK_OUTCOMES.unreachable) return <StateTag isOk={null}>Not checked this time</StateTag>;
  const network = readNetworkTag(member.isProvisioned ? member.networkStatus : null);
  return (
    <>
      <StateTag isOk={member.isProvisioned}>{member.isProvisioned ? "Has a Village user" : "No Village user"}</StateTag>
      <StateTag isOk={network.isOk}>{network.text}</StateTag>
      <StateTag isOk={member.isInGroup}>{member.isInGroup ? "In the group" : "Not in the group"}</StateTag>
    </>
  );
}

function MemberList({ members }: { members: CheckedMember[] }) {
  if (members.length === 0) return <CardDescription>No members yet.</CardDescription>;
  return (
    <ul className="grid gap-2.5" aria-label="Members">
      {members.map((member) => (
        <li key={member.userId} className="grid gap-2 rounded-field bg-muted px-4 py-3" data-member-check={member.email}>
          <p className="wrap-anywhere">
            <span className="type-label block">{member.name}</span>
            <span className="type-small block text-foreground-soft">{member.email}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <MemberTags member={member} />
          </div>
          <p className="type-micro text-foreground-soft">Checked {formatDateAndTimeUtc(member.checkedAt)}</p>
        </li>
      ))}
    </ul>
  );
}

export const metadata: Metadata = { title: PAGE_TITLES.adminVillage };

export default modulePage(networkManifest, async function AdminVillagePage() {
  await requireAdmin();
  const { check, members } = await readVillageCheck(getDatabase());
  return (
    <AdminSection title="Village check" description="Ask Village whether your keys work, the group exists, and each member has a Village user, connected and joined the group.">
      <div className="grid gap-5">
        <VillageCheckButton hasChecked={check !== null} />
        {check ? (
          <>
            <Summary check={check} members={members} />
            <Card className="grid gap-3">
              <CardTitle>Members</CardTitle>
              <MemberList members={members} />
            </Card>
          </>
        ) : (
          <Card>
            <CardDescription>Village hasn&apos;t been checked yet. The check uses no credits and takes a few seconds.</CardDescription>
          </Card>
        )}
      </div>
    </AdminSection>
  );
});
