import { permanentRedirect } from "next/navigation";

import { membersManifest } from "@/modules/members/manifest";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

import { toLegacyQuery, type LegacySearchParams } from "./legacy-query";

// Founderhall's address is /directory; links in older emails and bookmarks still work.
export default modulePage(membersManifest, async function LegacyMembersPage({ searchParams }: { searchParams: LegacySearchParams }) {
  permanentRedirect(`${ROUTES.members}${toLegacyQuery(await searchParams)}`);
});
