import { cn } from "cn";

const DEFAULT_LOGO_SIZE_PX = 16;

type CompanyLogoProps = { url: string | null | undefined; sizePx?: number; className?: string };

// A company's small logo, drawn before its name. Nothing when there is none.
export function CompanyLogo({ url, sizePx = DEFAULT_LOGO_SIZE_PX, className }: CompanyLogoProps) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a remote logo from public profiles, shown with no referrer
    <img
      data-slot="company-logo"
      src={url}
      alt=""
      width={sizePx}
      height={sizePx}
      referrerPolicy="no-referrer"
      style={{ width: sizePx, height: sizePx }}
      className={cn("inline-block shrink-0 rounded-[4px] bg-white object-contain mt-[0.15em] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]", className)}
    />
  );
}

type CompanyNameProps = { company: string; logoUrl: string | null | undefined; logoSizePx?: number; className?: string };

// A company name with its logo in front, when it has one.
export function CompanyName({ company, logoUrl, logoSizePx, className }: CompanyNameProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-start gap-1.5", className)}>
      <CompanyLogo url={logoUrl} sizePx={logoSizePx} />
      <span className="min-w-0 wrap-anywhere">{company}</span>
    </span>
  );
}
