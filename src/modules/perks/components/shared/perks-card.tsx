import { Gift } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

import { PERKS_PAGE } from "../../contract";

// On Today while Perks is on and a marketplace is saved.
export function PerksCard({ communityName }: { communityName: string }) {
  return (
    <Card className="sm:p-5">
      <CardTitle className="flex items-center gap-2">
        <Gift aria-hidden="true" className="size-5 text-brand-emphasis" />
        Perks
      </CardTitle>
      <p className="type-small mt-1.5 text-foreground-soft">Deals for {communityName} members, run by BuiltFirst.</p>
      <Button asChild variant="outline" size="sm" className="mt-3.5 w-full">
        <Link href={PERKS_PAGE}>See the perks</Link>
      </Button>
    </Card>
  );
}
