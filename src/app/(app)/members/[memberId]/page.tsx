import { permanentRedirect } from "next/navigation";

import { membersManifest } from "@/modules/members/manifest";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

// A member's profile lives at /people/<id> now.
export default modulePage(membersManifest, async function LegacyProfilePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  permanentRedirect(`${ROUTES.people}/${encodeURIComponent(memberId)}`);
});
