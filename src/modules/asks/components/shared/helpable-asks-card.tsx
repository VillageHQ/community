"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ASKS_PAGE } from "@/modules/asks/contract";
import { ASK_SKIP_ROUTE, describeWhyYou, skippedAskSchema, type HelpableAsk } from "@/modules/asks/contract-today";
import { postRequest } from "@/platform/http/post-request";

const RAIL_AVATAR_SIZE_PX = 44;

function HelpableAskRow({ ask }: { ask: HelpableAsk }) {
  const router = useRouter();
  const skip = useMutation({
    mutationFn: () => postRequest(ASK_SKIP_ROUTE, { askId: ask.id }, skippedAskSchema),
    onSuccess: () => router.refresh(),
  });
  return (
    <li className="grid gap-2.5">
      <div className="flex items-center gap-3">
        <Avatar stableId={ask.author.id} name={ask.author.name} imageUrl={ask.author.avatarUrl} sizePx={RAIL_AVATAR_SIZE_PX} />
        <div className="min-w-0">
          <p className="type-label wrap-anywhere">“{ask.title}”</p>
          <p className="type-micro font-medium wrap-anywhere text-muted-foreground">
            {ask.author.name} · {describeWhyYou(ask)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="px-4">
          <Link href={ASKS_PAGE}>I can help</Link>
        </Button>
        <Button
          variant="quiet"
          size="sm"
          className="px-4"
          disabled={skip.isPending}
          aria-label={`Not for me: ${ask.title}`}
          onClick={() => skip.mutate()}
        >
          Not for me
        </Button>
      </div>
      <FormError message={skip.error?.message ?? null} />
    </li>
  );
}

export function HelpableAsksCard({ asks }: { asks: readonly HelpableAsk[] }) {
  return (
    <Card className="sm:p-5">
      <CardTitle>Asks you could help with</CardTitle>
      <ul className="mt-3.5 grid gap-5">
        {asks.map((ask) => (
          <HelpableAskRow key={ask.id} ask={ask} />
        ))}
      </ul>
    </Card>
  );
}
