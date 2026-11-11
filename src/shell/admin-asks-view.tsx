import { Pin } from "lucide-react";

import { CardDescription } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { SettingCard } from "@/modules/admin/components/setting-card";
import { StatRows } from "@/modules/admin/components/stat-rows";
import { ASK_LIMITS } from "@/modules/asks/contract";
import { AdminAskList } from "@/modules/asks/components/admin-ask-list";
import { AllowanceForm } from "@/modules/asks/components/allowance-form";
import type { AdminAsks } from "@/shell/admin-asks";
import { ReportedAsks } from "@/shell/reported-asks";

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

// Admin › Asks: this quarter's numbers (counts only, like the partner report), then what needs the admin.
export function AdminAsksView({ quarterLabel, counts, oldest, pinned, reported, weeklyAllowance }: AdminAsks) {
  const canPin = pinned.length < ASK_LIMITS.pinnedAsks;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <SettingCard title={`Asks, ${quarterLabel}`} tag={null}>
        <StatRows
          rows={[
            { value: counts.asked, label: plural(counts.asked, "ask posted", "asks posted"), note: "Updates aren't counted." },
            { value: counts.answered, label: plural(counts.answered, "has an answer", "have an answer"), note: "At least one member answered under it." },
            {
              value: counts.closed,
              label: plural(counts.closed, "closed with an outcome", "closed with an outcome"),
              note: `${counts.solvedHere} helped here · ${counts.solvedElsewhere} solved elsewhere · ${counts.noLongerNeeded} no longer needed`,
            },
          ]}
        />
        <CardDescription>Counts only, as in the partner report. Asks of deleted accounts still count.</CardDescription>
      </SettingCard>
      <SettingCard title="Waiting longest, no answer yet" tag={null}>
        <CardDescription>Open asks nobody has answered, the oldest first. Pin one to get it seen.</CardDescription>
        <AdminAskList items={oldest} canPin={canPin} emptyText="Every open ask has an answer." />
      </SettingCard>
      <SettingCard
        title="Pinned to the top"
        tag={
          <Tag tone="accent">
            <Pin aria-hidden="true" />
            {pinned.length} of {ASK_LIMITS.pinnedAsks}
          </Tag>
        }
      >
        <CardDescription>Pinned asks stay at the top of the board until you unpin them or they close.</CardDescription>
        <AdminAskList items={pinned} canPin={canPin} emptyText="No ask is pinned. Pin one from the list above or from its menu on the board." />
      </SettingCard>
      <SettingCard title="Reported" tag={reported.length > 0 ? <Tag tone="destructive">{reported.length} waiting</Tag> : null}>
        <CardDescription>Asks and answers members flagged. The person who posted it isn&apos;t told either way.</CardDescription>
        <ReportedAsks reported={reported} />
      </SettingCard>
      <SettingCard title="Weekly ask allowance" tag={<Tag tone="neutral">{weeklyAllowance} a week</Tag>}>
        <AllowanceForm weeklyAllowance={weeklyAllowance} />
      </SettingCard>
    </div>
  );
}
