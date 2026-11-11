import { permanentRedirect } from "next/navigation";

import { membersManifest } from "@/modules/members/manifest";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

import { toLegacyQuery, type LegacySearchParams } from "../legacy-query";

// Your data lives at /me/data.
export default modulePage(membersManifest, async function LegacyDataPage({ searchParams }: { searchParams: LegacySearchParams }) {
  permanentRedirect(`${ROUTES.yourData}${toLegacyQuery(await searchParams)}`);
});
