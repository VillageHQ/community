import type { Metadata } from "next";
import Link from "next/link";

import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { ROUTES } from "@/platform/http/routes";

export const metadata: Metadata = { title: PAGE_TITLES.notFound };

// Founderhall's 404 inside the app (copy/member-perks-off.md): the dashed empty state, "Go to the start".
export default function AppNotFound() {
  return (
    <div data-slot="empty-state" className="fh-empty">
      <h1 className="fh-h2">That page isn’t here</h1>
      <p>
        <Link href={ROUTES.feed}>Go to the start</Link>
      </p>
    </div>
  );
}
