import { PERKS_FRAME_SANDBOX } from "../contract";

// BuiltFirst's marketplace in a sandboxed frame. Only an address checked as https on builtfirst.com reaches here.
export function PerksFrame({ url, title, className = "h-[75vh] min-h-[480px]" }: { url: string; title: string; className?: string }) {
  return (
    <iframe
      src={url}
      title={title}
      sandbox={PERKS_FRAME_SANDBOX}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`w-full rounded-field bg-white shadow-[inset_0_0_0_1.5px_var(--input)] ${className}`}
    />
  );
}
