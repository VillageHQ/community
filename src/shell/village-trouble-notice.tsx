import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { ROUTES } from "@/platform/http/routes";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";
import { VILLAGE_TROUBLES, type VillageHealth } from "@/platform/village/health";

import { SETUP_STEPS } from "./admin-setup-steps";

function readLastWorked({ lastOkAt }: VillageHealth) {
  return lastOkAt ? `It last worked on ${formatDateAndTimeUtc(lastOkAt)}.` : "It hasn't worked since the app started keeping track.";
}

// Shown on every admin page while Village is in trouble. It clears by itself after the next call Village answers.
export function VillageTroubleNotice({ health }: { health: VillageHealth }) {
  const isKeys = health.trouble === VILLAGE_TROUBLES.keysRejected;
  const failedAt = health.troubleAt ? ` on ${formatDateAndTimeUtc(health.troubleAt)}` : "";
  return (
    <Card role="status" className="mb-5 grid gap-2 shadow-[inset_0_0_0_2.5px_var(--destructive-text),var(--elevation-panel)]">
      <h2 className="type-h3 flex items-center gap-2 text-destructive-text">
        <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
        {isKeys ? "Village refused this community's keys" : "Village isn't answering"}
      </h2>
      <p className="text-foreground-soft">
        {isKeys ? `Village said no to the keys${failedAt}.` : `Village, the people-search service, didn't answer${failedAt}.`} {readLastWorked(health)} Network search and
        intro paths are paused, and members see &ldquo;Search is unavailable right now&rdquo; instead of an error. Everything else works. This clears by itself after
        the next call Village answers.
      </p>
      {isKeys ? (
        <p>
          <Link href={`${ROUTES.adminSettings}?step=${SETUP_STEPS.keys}`} className="font-bold underline underline-offset-4">
            Check the Village keys
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
