"use client";

import { useRouter } from "next/navigation";

import { LeaveGroup } from "./leave-group";

export function LeaveGroupCard() {
  const router = useRouter();
  return (
    <section aria-labelledby="leave-group-title" className="mt-5 grid gap-3 rounded-card bg-card p-5 shadow-panel sm:rounded-panel sm:p-7">
      <h2 id="leave-group-title" className="type-h3">
        You&apos;re still in the Village group
      </h2>
      <p className="type-small text-foreground-soft">
        This community turned off network search, but your network stays shared in Village until you leave the group.
      </p>
      <LeaveGroup onLeft={() => router.refresh()} />
    </section>
  );
}
