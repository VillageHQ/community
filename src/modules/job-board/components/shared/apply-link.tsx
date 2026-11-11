import { ExternalLink } from "lucide-react";

// The Apply button for one job, opening the hiring tool in a new tab.
export function ApplyLink({ url, title, company }: { url: string; title: string; company: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-card px-card-phone py-2 text-[15px] font-bold shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-muted max-sm:w-full max-sm:justify-center"
    >
      Apply
      <ExternalLink aria-hidden="true" className="size-4" />
      <span className="sr-only">
        {" "}
        for {title} at {company} (opens in a new tab)
      </span>
    </a>
  );
}
