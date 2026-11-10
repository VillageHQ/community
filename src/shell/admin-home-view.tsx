import { ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/platform/http/routes";
import type { AdminHomeItem } from "@/shell/admin-home";
import type { AdminTabFacts } from "@/shell/admin-badges";

import { AdminTabs } from "./admin-tabs";

type QuarterLine = { periodLabel: string; asked: number; introduced: number; helped: number } | null;

function readIntroWord(count: number) {
  return count === 1 ? "intro" : "intros";
}

// The serif line at the top: the same three numbers the partner report shows for this quarter. Counts only.
function QuarterIntros({ quarter }: { quarter: QuarterLine }) {
  if (!quarter) {
    return (
      <header className="mb-6">
        <h1 className="type-h1">Intros are switched off</h1>
        <p className="type-lead mt-1.5 text-foreground-soft">
          Turn them on in{" "}
          <Link href={ROUTES.adminFeatures} className="underline underline-offset-4">
            Features
          </Link>{" "}
          to see this quarter&apos;s intros here.
        </p>
      </header>
    );
  }
  const { periodLabel, asked, introduced, helped } = quarter;
  return (
    <header className="mb-6">
      <p className="type-micro font-bold text-brand-emphasis">{periodLabel}</p>
      <h1 className="type-h1 mt-1.5 sm:type-display" data-testid="admin-home-intros">
        {asked === 0 ? "No intros asked yet this quarter" : `${asked} ${readIntroWord(asked)} asked, ${introduced} made, ${helped} said it helped`}
      </h1>
      <p className="type-small mt-2 text-foreground-soft">Counts only. Who asked whom never appears here.</p>
    </header>
  );
}

function NeedsYou({ items }: { items: readonly AdminHomeItem[] }) {
  if (items.length === 0) {
    return <p className="mb-8 font-serif text-[17px] leading-6 text-foreground-soft italic">Nothing needs you right now.</p>;
  }
  return (
    <section aria-labelledby="admin-home-needs-you" className="mb-8">
      <h2 id="admin-home-needs-you" className="type-micro mb-2.5 font-bold text-muted-foreground uppercase">
        Needs you
      </h2>
      <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {items.map(({ id, label, href, isUrgent }) => (
          <li key={id}>
            <Link
              href={href}
              data-item={id}
              className={`type-small flex min-h-11 items-center gap-2 rounded-card bg-card px-4 py-2.5 font-semibold shadow-panel hover:shadow-[inset_0_0_0_1.5px_var(--input)] ${isUrgent ? "text-destructive-text" : "text-foreground"}`}
            >
              {isUrgent ? <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1">{label}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type AdminHomeViewProps = { quarter: QuarterLine; items: readonly AdminHomeItem[]; facts: AdminTabFacts };

export function AdminHomeView({ quarter, items, facts }: AdminHomeViewProps) {
  return (
    <>
      <QuarterIntros quarter={quarter} />
      <NeedsYou items={items} />
      <p className="mb-6">
        <Link href={ROUTES.adminReport} className="font-bold underline underline-offset-4">
          Open the full partner report
        </Link>
      </p>
      <h2 className="type-micro mb-2.5 font-bold text-muted-foreground uppercase">Everything else</h2>
      <AdminTabs facts={facts} />
    </>
  );
}
