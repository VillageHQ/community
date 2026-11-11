"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SearchWhere } from "@/modules/network/contract";
import { activeSearchQuery, networkSearchQuery } from "@/modules/network/queries";
import { ROUTES } from "@/platform/http/routes";

const NOTICE_COPY = {
  success: { title: "Your search is ready", action: "See who you found" },
  error: { title: "Your search didn't finish", action: "Back to Search" },
};

// A search runs on while the member browses; Founderhall's toast says when it is done.
function SearchOutcomeNotice({ prompt, scope }: { prompt: string; scope: SearchWhere }) {
  const { status } = useQuery({ ...networkSearchQuery(prompt, scope), enabled: false });
  if (status === "pending") return null;
  const { title, action } = NOTICE_COPY[status];
  return (
    <div role="status" data-slot="search-ready-notice" className="fh-toast">
      <Search aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>{title}</span>
      <Link href={`${ROUTES.network}?${new URLSearchParams({ q: prompt, scope }).toString()}`} className="font-semibold text-paper underline">
        {action}
      </Link>
    </div>
  );
}

export function SearchReadyNotice() {
  const pathname = usePathname();
  const { data: active } = useQuery(activeSearchQuery);
  if (!active || active.wasSeen || pathname === ROUTES.network) return null;
  return <SearchOutcomeNotice prompt={active.prompt} scope={active.scope} />;
}
