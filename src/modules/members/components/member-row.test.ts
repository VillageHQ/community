import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DirectoryMember } from "@/modules/members/contract-profile";

import { MemberRow } from "./member-directory";

const AMARA: DirectoryMember = {
  id: "member-amara",
  name: "Amara Diallo",
  title: "Founder & CEO",
  company: "Kilnworks",
  location: "Paris",
  bio: "Low-carbon cement for precast makers.",
  canHelpWith: null,
  freshAt: "2026-10-31T09:00:00.000Z",
  stage: "Series A",
  sector: "Climate",
  cohort: null,
  avatarUrl: null,
  companyLogoUrl: null,
  hiringJobCount: 1,
  tags: [],
};

// The 2026-11-12 parity audit (PROF-15): a hiring founder's directory card listed no jobs.
describe("a directory card", () => {
  it("says the member's company is hiring, and how many jobs are open", () => {
    expect(renderToStaticMarkup(createElement(MemberRow, { member: AMARA }))).toContain("Hiring · 1 open job");
    expect(renderToStaticMarkup(createElement(MemberRow, { member: { ...AMARA, hiringJobCount: 3 } }))).toContain("Hiring · 3 open jobs");
  });

  it("says nothing about jobs when there are none, or the job board is off", () => {
    expect(renderToStaticMarkup(createElement(MemberRow, { member: { ...AMARA, hiringJobCount: 0 } }))).not.toContain("Hiring");
  });
});
