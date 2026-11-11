import { permanentRedirect } from "next/navigation";

import { membersManifest } from "@/modules/members/manifest";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

import { toLegacyQuery, type LegacySearchParams } from "../legacy-query";

// "Your card" is My profile, at /me.
export default modulePage(membersManifest, async function LegacyCardPage({ searchParams }: { searchParams: LegacySearchParams }) {
  permanentRedirect(`${ROUTES.editCard}${toLegacyQuery(await searchParams)}`);
});
