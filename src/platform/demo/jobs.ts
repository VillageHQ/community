import { DEMO_EMAIL_DOMAIN } from "./mode.ts";

// The demo's job board, the same made-up jobs as Founderhall's demo: three founders linked their company's hiring tool, and these are the jobs a pull "found".
// Every company, link and job is made up; the links point at example.com. In demo mode the hourly pull never
// fetches, so these jobs stay until the nightly reset seeds them again.

export type DemoJob = { title: string; location: string; department: string; postedDaysAgo: number };
export type DemoJobSource = { founder: string; tool: "greenhouse" | "lever" | "ashby" | "workable"; slug: string; linkedDaysAgo: number; jobs: readonly DemoJob[] };

export const DEMO_JOB_SOURCES: readonly DemoJobSource[] = [
  {
    founder: "amara.diallo",
    tool: "workable",
    slug: "kilnworks",
    linkedDaysAgo: 20,
    jobs: [{ title: "Process engineer, kiln retrofits", location: "Paris", department: "Engineering", postedDaysAgo: 1 }],
  },
  {
    founder: "sam.lee",
    tool: "ashby",
    slug: "tallyhealth",
    linkedDaysAgo: 30,
    jobs: [
      { title: "Founding account executive", location: "Boston", department: "Sales", postedDaysAgo: 2 },
      { title: "Clinical product lead", location: "Remote (US)", department: "Product", postedDaysAgo: 9 },
    ],
  },
  {
    founder: "priya.shah",
    tool: "greenhouse",
    slug: "ledgerline",
    linkedDaysAgo: 45,
    jobs: [
      { title: "Senior backend engineer", location: "London or remote (UK)", department: "Engineering", postedDaysAgo: 3 },
      { title: "VP Sales", location: "London", department: "Sales", postedDaysAgo: 7 },
    ],
  },
];

// The careers page a founder pasted, and a job's apply link: both on example.com, so a click reaches no one.
export function toDemoCareersUrl(slug: string) {
  return `https://${slug}.${DEMO_EMAIL_DOMAIN}/careers`;
}

export function toDemoJobUrl(slug: string, externalId: string) {
  return `${toDemoCareersUrl(slug)}/${externalId}`;
}
