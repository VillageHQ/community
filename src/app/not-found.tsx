import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicPage } from "@/components/public-page";
import { readBrandingForPage } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";

export const metadata: Metadata = { title: PAGE_TITLES.notFound };

// Founderhall's 404 (server.mjs notFound): the dashed empty box inside the public card.
export default async function NotFound() {
  await connection();
  const { name, logo } = await readBrandingForPage();
  return (
    <PublicPage community={{ name, logo }} slot="centered-page">
      <div className="fh-empty">
        <h1 className="fh-h2">That page isn’t here</h1>
        <p>
          <a href={ROUTES.feed}>Go to the start</a>
        </p>
      </div>
    </PublicPage>
  );
}
