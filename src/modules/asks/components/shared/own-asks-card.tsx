import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ASKS_PAGE, type OwnAsk } from "@/modules/asks/contract";

function describeOffers(ask: OwnAsk) {
  const newCount = ask.offers.filter(({ isNew }) => isNew).length;
  if (ask.offers.length === 0) return "No offers yet";
  const total = ask.offers.length === 1 ? "1 offer" : `${ask.offers.length} offers`;
  return newCount > 0 ? `${total}, ${newCount} new` : total;
}

export function OwnAsksCard({ asks }: { asks: readonly OwnAsk[] }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>Your asks</CardTitle>
      <ul className="mt-3.5 grid gap-3">
        {asks.map((ask) => (
          <li key={ask.id} className="min-w-0">
            <p className="type-label wrap-anywhere">“{ask.title}”</p>
            <p className="type-micro font-medium text-muted-foreground">{describeOffers(ask)}</p>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
        <Link href={ASKS_PAGE}>Open your asks</Link>
      </Button>
    </Card>
  );
}
