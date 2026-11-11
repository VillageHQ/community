import { notFound } from "next/navigation";

import { modulePage } from "@/platform/modules/module-page";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";

// Where src/proxy.ts sends a signed-in member who opens a switched-off module's page: a real 404 inside the app's
// frame (Founderhall's member-perks-off), shown by (app)/not-found.tsx.
export default modulePage(PLATFORM_MANIFEST, async function NotHerePage() {
  notFound();
});
