import { cn } from "cn";

import { PERKS_FRAME_SANDBOX } from "../contract";

// BuiltFirst's marketplace in a sandboxed frame (Founderhall's `.perks-frame`: Leaf, a rule, radius 8, 1600 px tall;
// `isPreview` = 520 px, for the admin's preview). Only an address checked as https on builtfirst.com reaches here.
export function PerksFrame({ url, title, isPreview = false }: { url: string; title: string; isPreview?: boolean }) {
  return (
    <div className={cn("fh-perks-frame", isPreview && "fh-preview")}>
      <iframe src={url} title={title} sandbox={PERKS_FRAME_SANDBOX} referrerPolicy="no-referrer" loading="lazy" />
    </div>
  );
}
