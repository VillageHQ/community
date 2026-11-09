import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { readIntroCommunityCounts } from "@/modules/intros/reads";

type IntroCommunityCounts = Awaited<ReturnType<typeof readIntroCommunityCounts>>;

const COUNT_LABELS: { key: keyof IntroCommunityCounts; label: string }[] = [
  { key: "asked", label: "Asked" },
  { key: "introduced", label: "Introduced" },
  { key: "declined", label: "Declined" },
  { key: "helped", label: "Helped" },
];

export function IntroCountsCard({ counts }: { counts: IntroCommunityCounts }) {
  return (
    <Card className="grid gap-4">
      <div className="grid gap-1.5">
        <CardTitle>Intros</CardTitle>
        <CardDescription>Totals only. Who asked whom, what they wrote and who said no stays private.</CardDescription>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {COUNT_LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-field bg-muted px-4 py-3">
            <dt className="type-small text-foreground-soft">{label}</dt>
            <dd className="type-h3">{counts[key]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
