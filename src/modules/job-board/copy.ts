import type { BoardCompany } from "./contract.ts";

// Founderhall's job board words (copy/member-jobs-board.md, public-jobs-board.md).

function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

export function readCompaniesWithJobs(companies: readonly BoardCompany[]) {
  return companies.filter(({ jobCount }) => jobCount > 0);
}

export const APPLY_LINE = "Apply on each company’s own page.";

// "5 open jobs at 3 companies in Northwind Founders, newest first. Apply on each company’s own page."
export function describeMemberBoard({ total, companies, current, communityName }: { total: number; companies: readonly BoardCompany[]; current: BoardCompany | null; communityName: string }) {
  if (total === 0) return `No open jobs on the board yet. ${APPLY_LINE}`;
  const where = current ? current.name : `${plural(readCompaniesWithJobs(companies).length, "company", "companies")} in ${communityName}`;
  return `${plural(total, "open job")} at ${where}, newest first. ${APPLY_LINE}`;
}

// "5 open jobs at 3 companies backed by Northwind Founders, newest first. Apply on each company’s own page."
export function describePublicBoard({ total, companies, current, communityName }: { total: number; companies: readonly BoardCompany[]; current: BoardCompany | null; communityName: string }) {
  if (total === 0) return "No open jobs right now.";
  const where = current ? "" : ` at ${plural(readCompaniesWithJobs(companies).length, "company", "companies")} backed by ${communityName}`;
  return `${plural(total, "open job")}${where}, newest first. ${APPLY_LINE}`;
}

export function describeEmptyBoard(current: BoardCompany | null) {
  return {
    title: `No open jobs${current ? ` at ${current.name}` : ""} yet`,
    description: "When a founder links their company’s job board on My profile, its open jobs show here within the hour.",
  };
}

export const HIRING_LINE = { before: "Hiring? ", link: "Add your company’s jobs", after: " on My profile." } as const;

export function describePublicTitle(communityName: string, current: BoardCompany | null) {
  return current ? `Jobs at ${current.name}` : `Jobs at ${communityName} companies`;
}
