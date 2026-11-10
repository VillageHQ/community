import { DEMO_EMAIL_DOMAIN } from "./mode.ts";

// The demo's job board: four founders linked their company's hiring tool, and these are the jobs a pull "found".
// Every company, link and job is made up; the links point at example.com. In demo mode the hourly pull never
// fetches, so these jobs stay until the nightly reset seeds them again.

export type DemoJob = { title: string; location: string; department: string; postedDaysAgo: number };
export type DemoJobSource = { founder: string; tool: "greenhouse" | "lever" | "ashby" | "workable"; slug: string; linkedDaysAgo: number; jobs: readonly DemoJob[] };

export const DEMO_JOB_SOURCES: readonly DemoJobSource[] = [
  {
    founder: "sam.lee",
    tool: "ashby",
    slug: "tallyhealth",
    linkedDaysAgo: 30,
    jobs: [
      { title: "Founding Account Executive, Health Systems", location: "New York", department: "Sales", postedDaysAgo: 3 },
      { title: "Senior Backend Engineer", location: "New York or remote (US)", department: "Engineering", postedDaysAgo: 9 },
      { title: "Clinical Operations Lead", location: "New York", department: "Operations", postedDaysAgo: 14 },
      { title: "Product Designer", location: "Remote (US)", department: "Design", postedDaysAgo: 21 },
    ],
  },
  {
    founder: "priya.shah",
    tool: "greenhouse",
    slug: "ledgerline",
    linkedDaysAgo: 45,
    jobs: [
      { title: "VP Sales", location: "London", department: "Sales", postedDaysAgo: 4 },
      { title: "Solutions Engineer", location: "London", department: "Sales", postedDaysAgo: 12 },
      { title: "Senior Data Engineer", location: "London or remote (UK)", department: "Engineering", postedDaysAgo: 26 },
    ],
  },
  {
    founder: "amara.diallo",
    tool: "workable",
    slug: "kilnworks",
    linkedDaysAgo: 20,
    jobs: [
      { title: "Plant Manager", location: "Lyon", department: "Operations", postedDaysAgo: 6 },
      { title: "Process Engineer, Kilns", location: "Lyon", department: "Engineering", postedDaysAgo: 18 },
    ],
  },
  {
    founder: "ravi.menon",
    tool: "lever",
    slug: "stackwise",
    linkedDaysAgo: 60,
    jobs: [
      { title: "Head of Sales, North America", location: "San Francisco or New York", department: "Sales", postedDaysAgo: 2 },
      { title: "Developer Advocate", location: "Remote", department: "Marketing", postedDaysAgo: 8 },
      { title: "Senior Frontend Engineer", location: "Bangalore", department: "Engineering", postedDaysAgo: 15 },
      { title: "Customer Success Manager", location: "Remote (US)", department: "Customer Success", postedDaysAgo: 19 },
      { title: "Staff Engineer, Query Engine", location: "Bangalore", department: "Engineering", postedDaysAgo: 33 },
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
