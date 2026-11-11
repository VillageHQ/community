import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QueryProvider } from "@/components/query-provider";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";
import { buildShellNavigation } from "@/shell/navigation";

import { PartsGallery, type Crop } from "./parts-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Parts", robots: { index: false, follow: false } };

// Founderhall's crops of each part, kept with the build that matched them.
const CROPS_DIRECTORY = resolve(process.cwd(), ".ai/features/fh-foundation/crops");

function readCrops() {
  try {
    return Object.fromEntries(
      readdirSync(CROPS_DIRECTORY)
        .filter((file) => file.endsWith(".png"))
        .map((file) => {
          const bytes = readFileSync(resolve(CROPS_DIRECTORY, file));
          // A PNG keeps its width at byte 16.
          const crop: Crop = { src: `data:image/png;base64,${bytes.toString("base64")}`, width: bytes.readUInt32BE(16) };
          return [file.replace(/\.png$/, ""), crop] as const;
        }),
    );
  } catch {
    return {};
  }
}

// The parts review page: every shared part beside Founderhall's crop of it. A test page, off unless
// SHOW_PARTS_PAGE=true, so a real community never serves it.
export default modulePage(PLATFORM_MANIFEST, async function PartsPage() {
  if (process.env.SHOW_PARTS_PAGE !== "true") notFound();
  return (
    <QueryProvider>
      <PartsGallery crops={readCrops()} navigation={buildShellNavigation(undefined, true)} />
    </QueryProvider>
  );
});
