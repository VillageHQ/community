import type { ReactNode } from "react";

import { CompanyLogo } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";

const PROFILE_AVATAR_SIZE_PX = 80;
const PROFILE_LOGO_SIZE_PX = 20;

type ProfileHeadProps = {
  memberId: string;
  name: string;
  imageUrl: string | null;
  companyLogoUrl: string | null;
  hasCompany: boolean;
  roleLine: string;
  children?: ReactNode;
};

// Founderhall's profile head (crop profile-head.png): the 80 px photo, the serif name, logo + "Role, Company · City",
// then what the page adds under it (chips and actions, or "This is how members see you").
export function ProfileHead({ memberId, name, imageUrl, companyLogoUrl, hasCompany, roleLine, children }: ProfileHeadProps) {
  return (
    <div className="fh-profile-head">
      <Avatar stableId={memberId} name={name} imageUrl={imageUrl} sizePx={PROFILE_AVATAR_SIZE_PX} />
      <div className="min-w-0">
        <h1 className="fh-h1 wrap-anywhere">{name}</h1>
        {roleLine ? (
          <p className="wrap-anywhere">
            {hasCompany ? <CompanyLogo url={companyLogoUrl} sizePx={PROFILE_LOGO_SIZE_PX} className="fh-colog fh-md mt-0" /> : null}
            {roleLine}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
