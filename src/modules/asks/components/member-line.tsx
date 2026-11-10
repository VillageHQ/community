import { CompanyLogo } from "@/components/company-name";

type LineMember = { title: string | null; company: string | null; companyLogoUrl?: string | null };

// "Role, Company" with the company's logo in front of the company, when it has one.
export function MemberLine({ member }: { member: LineMember }) {
  const { title, company, companyLogoUrl } = member;
  if (!title && !company) return null;
  return (
    <>
      {title}
      {title && company ? ", " : null}
      {company ? (
        <>
          <CompanyLogo url={companyLogoUrl} sizePx={14} className="mr-1 mt-0 align-[-0.15em]" />
          {company}
        </>
      ) : null}
    </>
  );
}
