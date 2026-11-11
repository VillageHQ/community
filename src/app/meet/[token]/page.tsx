import { permanentRedirect } from "next/navigation";

import { introsManifest } from "@/modules/intros/manifest";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";

// The person's page moved to Founderhall's `/i/<token>`; links already sent keep working.
export default modulePage(introsManifest, async function OldIntroConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  permanentRedirect(`${ROUTES.introConsent}/${encodeURIComponent(token)}`);
});
