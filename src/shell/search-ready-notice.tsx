"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeSearchQuery, networkSearchQuery } from "@/modules/network/queries";
import { ROUTES } from "@/platform/http/routes";

const NOTICE_COPY = {
  success: { title: "Your search is ready", action: "See who you found" },
  error: { title: "Your search didn't finish", action: "Back to Network" },
};

function SearchOutcomeNotice({ prompt }: { prompt: string }) {
  const { status } = useQuery({ ...networkSearchQuery(prompt), enabled: false });
  if (status === "pending") return null;
  const { title, action } = NOTICE_COPY[status];
  return (
    <div
      role="status"
      data-slot="search-ready-notice"
      className="fixed inset-x-3.5 bottom-[104px] z-20 flex items-center gap-3 rounded-field bg-card p-3 pl-4 shadow-sheet lg:inset-x-auto lg:right-8 lg:bottom-8 lg:max-w-[420px]"
    >
      <Search aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
      <p className="type-label min-w-0 flex-1">{title}</p>
      <Link
        href={ROUTES.network}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-[15px] font-bold text-primary-foreground"
      >
        {action}
      </Link>
    </div>
  );
}

export function SearchReadyNotice() {
  const pathname = usePathname();
  const { data: active } = useQuery(activeSearchQuery);
  if (!active || active.wasSeen || pathname === ROUTES.network) return null;
  return <SearchOutcomeNotice prompt={active.prompt} />;
}
