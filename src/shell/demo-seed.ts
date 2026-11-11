import "server-only";

import { randomUUID } from "node:crypto";

import { ask, askAnswer, askHelper, askOffer } from "@/modules/asks/schema";
import { asksManifest } from "@/modules/asks/manifest";
import { chatManifest } from "@/modules/chat/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { introRequest } from "@/modules/intros/schema";
import { introsManifest } from "@/modules/intros/manifest";
import { PUBLIC_BOARD_SETTING, toCompanySlug } from "@/modules/job-board/contract";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { jobPosting, jobSource } from "@/modules/job-board/schema";
import { invite, memberFillIn, memberLookup, memberNetwork, memberProfile, memberTag } from "@/modules/members/schema";
import { FILL_IN_BASES, LOOKUP_STATUSES } from "@/modules/members/contract-fill-in";
import { saveFillInSettings } from "@/modules/members/service-fill-in";
import { toFilledProfile } from "@/modules/network/rules-fill-in";
import { createInviteToken, hashInviteToken } from "@/modules/members/service-invite-token";
import { messagesManifest } from "@/modules/messages/manifest";
import { conversation, conversationReadCursor, directMessage } from "@/modules/messages/schema";
import { networkManifest } from "@/modules/network/manifest";
import { perksManifest } from "@/modules/perks/manifest";
import { user } from "@/platform/database/auth-schema";
import type { Transaction } from "@/platform/database/client";
import { communityBranding } from "@/platform/branding/schema";
import { DEMO_JOB_SOURCES, toDemoCareersUrl, toDemoJobUrl } from "@/platform/demo/jobs";
import { DEMO_COMMUNITY, DEMO_DATA_HOME, DEMO_INVITEES, DEMO_OUTSIDERS, DEMO_PEOPLE, toDemoEmail, toDemoSlug, type DemoPerson } from "@/platform/demo/people";
import { DEMO_VILLAGE_GROUP, DEMO_VILLAGE_KEYS, toDemoProfile } from "@/platform/demo/village-answers";
import { toDemoDomain, toDemoLogoUrl } from "@/platform/demo/pictures";
import type { Environment } from "@/platform/environment";
import { saveModuleState } from "@/platform/modules/enablement";
import { saveSettings } from "@/platform/settings/store";
import { toDataHomeSettings } from "@/platform/settings/data-home";
import { INSTANCE_SETTING_KEYS } from "@/platform/settings/schema";
import { saveVillageKeys } from "@/platform/village/settings";

// Fills an empty database with the demo community. Runs inside the caller's transaction: at start on an empty
// database, and every night after the reset empties it. Every date is relative to `now`, so the demo always looks
// current: fresh intros waiting, asks still open, and two quarters of history for the partner report.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const INTRO_LIFETIME_DAYS = 14;
const INVITE_LIFETIME_DAYS = 14;

type Ids = ReadonlyMap<string, string>;

const CITY_FROM_FILL_IN = { key: "sam.lee", daysAgo: 9 } as const;

function makeClock(now: Date) {
  return (days: number, hours = 0) => new Date(now.getTime() - days * DAY_MS - hours * HOUR_MS);
}

function person(key: string) {
  const found = DEMO_PEOPLE.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`The demo has no person "${key}".`);
  return found;
}

function outsider(slug: string) {
  const found = DEMO_OUTSIDERS.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`The demo has no outsider "${slug}".`);
  return found;
}

async function seedMembers(transaction: Transaction, ago: ReturnType<typeof makeClock>) {
  const ids = new Map<string, string>();
  for (const demoPerson of DEMO_PEOPLE) {
    const id = randomUUID();
    ids.set(demoPerson.key, id);
    const joinedAt = ago(demoPerson.joinedDaysAgo);
    await transaction.insert(user).values({
      id,
      name: demoPerson.name,
      email: toDemoEmail(demoPerson),
      emailVerified: true,
      role: demoPerson.isAdmin ? "admin" : "user",
      createdAt: joinedAt,
      updatedAt: joinedAt,
    });
    await transaction.insert(memberProfile).values({
      userId: id,
      title: demoPerson.title,
      company: demoPerson.company,
      // Sam's city comes from public profiles, not his own words, so his Today asks "Is this right?" (as Founderhall's demo).
      location: demoPerson.key === CITY_FROM_FILL_IN.key ? null : demoPerson.location,
      bio: demoPerson.bio,
      canHelpWith: demoPerson.canHelpWith,
      needs: demoPerson.needs,
      stage: demoPerson.stage,
      sector: demoPerson.sector,
      cohort: demoPerson.cohort,
      creditInReports: demoPerson.creditInReports ?? false,
      cardStepDoneAt: joinedAt,
      onboardingCompletedAt: joinedAt,
      updatedAt: ago(Math.min(demoPerson.joinedDaysAgo, 12)),
    });
    if (demoPerson.tags.length > 0) {
      await transaction.insert(memberTag).values(demoPerson.tags.map((tag) => ({ userId: id, tag, normalizedTag: tag.toLowerCase() })));
    }
    const slug = toDemoSlug(demoPerson);
    const linkedAt = ago(Math.max(demoPerson.joinedDaysAgo - 2, 1));
    await transaction.insert(memberNetwork).values({
      userId: id,
      linkedinSlug: slug,
      linkedinConfirmedSlug: slug,
      ...(demoPerson.sharesNetwork ? { sharingConsentedAt: linkedAt, groupJoinedAt: linkedAt, villageLinkedAt: linkedAt } : {}),
    });
  }
  return ids;
}

async function seedInvites(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  const admin = person("maya.ortiz");
  for (const invitee of DEMO_INVITEES) {
    const createdAt = ago(invitee.daysAgo);
    await transaction.insert(invite).values({
      email: toDemoEmail(invitee),
      inviteeName: invitee.name,
      company: invitee.company,
      cohort: invitee.cohort,
      tokenHash: hashInviteToken(createInviteToken()),
      invitedByUserId: ids.get(admin.key) ?? null,
      invitedByName: admin.name,
      expiresAt: new Date(createdAt.getTime() + INVITE_LIFETIME_DAYS * DAY_MS),
      createdAt,
    });
  }
}

type IntroSeed = {
  requester: string;
  introducer: string;
  target: string;
  state: (typeof introRequest.$inferInsert)["state"];
  daysAgo: number;
  reason: string;
  note: string;
  extra?: (createdAt: Date) => Partial<typeof introRequest.$inferInsert>;
};

function headline(demoPerson: DemoPerson) {
  return `${demoPerson.title} at ${demoPerson.company}`;
}

const CURRENT_INTROS: readonly IntroSeed[] = [
  {
    requester: "sam.lee",
    introducer: "priya.shah",
    target: "dana-whitfield-demo",
    state: "requested",
    daysAgo: 1,
    reason: "Priya and Dana sat on the same fintech panel last spring.",
    note: "Hi Priya! Dana runs procurement at Lakeshore Health. We're looking for our first hospital group and a warm word from you would mean a lot.",
  },
  {
    requester: "sam.lee",
    introducer: "marcus.webb",
    target: "nina-patel-demo",
    state: "asking_target",
    daysAgo: 3,
    reason: "Marcus advised St. Ambrose on their data platform.",
    note: "Marcus, could you ask Nina if she'd take a 20-minute call about prior-authorisation? Happy to send a short deck first.",
    extra: (createdAt) => ({ askedTargetAt: new Date(createdAt.getTime() + DAY_MS), askedEmailAt: createdAt }),
  },
  {
    requester: "sam.lee",
    introducer: "julia.weber",
    target: "claire-dubois-demo",
    state: "target_agreed",
    daysAgo: 6,
    reason: "Julia and Claire co-invested in two climate rounds.",
    note: "Julia, we're opening our seed extension next month. Claire's fund would be a great fit if she's open to a chat.",
    extra: (createdAt) => ({ askedTargetAt: new Date(createdAt.getTime() + DAY_MS), targetAgreedAt: new Date(createdAt.getTime() + 2 * DAY_MS) }),
  },
  {
    requester: "sam.lee",
    introducer: "ada.okafor",
    target: "mei-chen-demo",
    state: "declined",
    daysAgo: 20,
    reason: "Ada met Mei at a supply-chain meetup.",
    note: "Ada, would you introduce me to Mei? We're exploring a pilot with a food cooperative's clinic network.",
    extra: (createdAt) => ({ closedAt: new Date(createdAt.getTime() + DAY_MS), declineKind: "not_this_time", declineReason: "Mei is heads-down on a merger this month. Ask me again in the new year!" }),
  },
  // Founderhall's demo: the one intro waiting for Sam's yes on Today.
  {
    requester: "marcus.webb",
    introducer: "sam.lee",
    target: "rachel-kim-demo",
    state: "requested",
    daysAgo: 1,
    reason: "Sam and Rachel worked together on a clinic supply pilot.",
    note: "I’m Marcus, CTO of Brightwater Logistics: route planning for inland shipping.\n\nBrightside is moving its supply contracts in-house, and I’d value 20 minutes with Rachel on how they plan deliveries.\n\nWe cut late deliveries by 40% for two Dutch hospital groups.",
  },
  {
    requester: "ravi.menon",
    introducer: "julia.weber",
    target: "alex-morgan-demo",
    state: "accepted",
    daysAgo: 9,
    reason: "Julia hired Alex's team for a sales workshop.",
    note: "Julia, Alex is the VP Sales I mentioned at the dinner. Would love a warm intro while we're hiring a US head of sales.",
    extra: (createdAt) => ({ acceptedAt: new Date(createdAt.getTime() + DAY_MS) }),
  },
  {
    requester: "lena.fischer",
    introducer: "diego.alvarez",
    target: "mei-chen-demo",
    state: "withdrawn",
    daysAgo: 30,
    reason: "Diego sells to Mei's cooperative.",
    note: "Diego, could you introduce me to Mei? We'd like to stock cooperative brands in Berlin shops.",
    extra: (createdAt) => ({ closedAt: new Date(createdAt.getTime() + 2 * DAY_MS) }),
  },
  {
    requester: "kwame.asante",
    introducer: "marcus.webb",
    target: "peter-van-dijk-demo",
    state: "expired",
    daysAgo: 24,
    reason: "Marcus and Peter both work in Rotterdam's inland port.",
    note: "Marcus, Peter's forwarding firm handles a lot of West African freight. Could you put us in touch?",
    extra: (createdAt) => ({ closedAt: new Date(createdAt.getTime() + INTRO_LIFETIME_DAYS * DAY_MS) }),
  },
  {
    requester: "zara.ahmed",
    introducer: "julia.weber",
    target: "omar-haddad-demo",
    state: "target_declined",
    daysAgo: 15,
    reason: "Julia sits on a board with Omar.",
    note: "Julia, we'd love ten minutes with Omar about contract review for the bank's legal team.",
    extra: (createdAt) => ({ askedTargetAt: new Date(createdAt.getTime() + DAY_MS), closedAt: new Date(createdAt.getTime() + 3 * DAY_MS) }),
  },
  {
    requester: "sam.lee",
    introducer: "elena.rossi",
    target: "jonas-lind-demo",
    state: "completed",
    daysAgo: 40,
    reason: "Elena's first angel cheque came from Jonas.",
    note: "Elena, Jonas backs health founders in the Nordics. Would you introduce us ahead of our seed round?",
    extra: (createdAt) => completed(createdAt, "helped", ["investor"]),
  },
];

function completed(createdAt: Date, outcome: "helped" | "not_yet" | "not_helped", results: readonly ("customer" | "hire" | "investor")[] = []) {
  return {
    askedTargetAt: new Date(createdAt.getTime() + DAY_MS),
    targetAgreedAt: new Date(createdAt.getTime() + 2 * DAY_MS),
    closedAt: new Date(createdAt.getTime() + 3 * DAY_MS),
    outcome,
    outcomeAnsweredAt: new Date(createdAt.getTime() + 17 * DAY_MS),
    outcomeResults: outcome === "helped" ? [...results] : null,
  };
}

// Two quarters of finished intros, so the partner report has real-looking counts.
const HISTORY_PAIRS: readonly [string, string][] = [
  ["priya.shah", "marcus.webb"],
  ["ada.okafor", "julia.weber"],
  ["elena.rossi", "priya.shah"],
  ["diego.alvarez", "lena.fischer"],
  ["amara.diallo", "julia.weber"],
  ["ravi.menon", "tomas.novak"],
  ["oliver.grant", "sam.lee"],
  ["felix.moreau", "amara.diallo"],
  ["tomas.novak", "ravi.menon"],
  ["zara.ahmed", "elena.rossi"],
  ["lena.fischer", "maya.ortiz"],
  ["grace.kim", "priya.shah"],
  ["ines.costa", "diego.alvarez"],
  ["hana.sato", "zara.ahmed"],
  ["noah.berg", "maya.ortiz"],
  ["marcus.webb", "ravi.menon"],
  ["priya.shah", "maya.ortiz"],
  ["amara.diallo", "ada.okafor"],
];
const HISTORY_OUTCOMES = [
  ["helped", ["customer"]],
  ["helped", ["hire"]],
  ["not_yet", []],
  ["helped", ["investor"]],
  ["helped", ["customer", "hire"]],
  ["not_helped", []],
] as const;

function historyIntros(): IntroSeed[] {
  return HISTORY_PAIRS.map(([requester, introducer], index) => {
    const target = DEMO_OUTSIDERS[index % DEMO_OUTSIDERS.length] ?? DEMO_OUTSIDERS[0];
    const [outcome, results] = HISTORY_OUTCOMES[index % HISTORY_OUTCOMES.length] ?? HISTORY_OUTCOMES[0];
    return {
      requester,
      introducer,
      target: target?.slug ?? "",
      state: "completed",
      daysAgo: 25 + index * 9,
      reason: `${person(introducer).name.split(" ")[0]} has worked with ${target?.name.split(" ")[0] ?? "them"} before.`,
      note: `Hi ${person(introducer).name.split(" ")[0]}, would you introduce me to ${target?.name ?? "them"}? A short call would help a lot.`,
      extra: (createdAt) => completed(createdAt, outcome, results),
    };
  });
}

async function seedIntros(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  for (const seed of [...CURRENT_INTROS, ...historyIntros()]) {
    const requester = person(seed.requester);
    const introducer = person(seed.introducer);
    const target = outsider(seed.target);
    const createdAt = ago(seed.daysAgo, 3);
    await transaction.insert(introRequest).values({
      requesterId: ids.get(requester.key) ?? "",
      introducerId: ids.get(introducer.key) ?? "",
      targetLinkedinSlug: target.slug,
      targetName: target.name,
      targetHeadline: `${target.title} at ${target.company}`,
      introducerName: introducer.name,
      introducerHeadline: headline(introducer),
      introducerLinkedinSlug: toDemoSlug(introducer),
      reason: seed.reason,
      note: seed.note,
      state: seed.state,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + INTRO_LIFETIME_DAYS * DAY_MS),
      ...(seed.extra?.(createdAt) ?? {}),
    });
  }
}

// Founderhall's demo asks, word for word, so the two apps compare on the same people: 8 asks and 2 updates.
type AskHelperSeed = { helper: string; reason: "path" | "words"; why: string; person?: string; title?: string; warmth?: "close" | "knows" | "met" };
type AskAnswerSeed = { author: string; body: string; kind?: "answer" | "know_someone" | "done_myself"; daysAgo: number; hoursAgo?: number };

type AskSeed = {
  author: string;
  title: string;
  category: (typeof ask.$inferInsert)["category"];
  kind?: "ask" | "update";
  daysAgo: number;
  hoursAgo?: number;
  targetText?: string;
  targetCompany?: string;
  pinned?: boolean;
  answeredDaysAgo?: number;
  helpers?: readonly AskHelperSeed[];
  answers?: readonly AskAnswerSeed[];
};

const ASKS: readonly AskSeed[] = [
  {
    author: "sam.lee",
    title: "Looking for an intro to someone who runs procurement at a US hospital group. Two pilots live; we need a buyer’s view on our 2027 pitch.",
    category: "customer",
    daysAgo: 12,
    targetText: "Head of procurement at a US hospital",
    answeredDaysAgo: 10,
    helpers: [{ helper: "priya.shah", reason: "path", why: "Worked together at Brightline Payments", person: "Alex Kim", title: "Head of Procurement at Halcyon Health", warmth: "close" }],
    answers: [
      { author: "priya.shah", body: "I worked with Alex for three years at Brightline. Happy to ask.", kind: "know_someone", daysAgo: 11, hoursAgo: 20 },
      { author: "sam.lee", body: "Introduced, and we’re meeting next week. Thank you Priya.", daysAgo: 8 },
    ],
  },
  {
    author: "sam.lee",
    title: "Who has hired a first VP Sales selling to US hospitals? I want an hour with someone who has done it.",
    category: "hire",
    daysAgo: 3,
    targetText: "a VP Sales who has sold to hospitals",
    helpers: [{ helper: "priya.shah", reason: "words", why: "can help with “Founders selling to CFOs; first sales hires in the UK.”" }],
    answers: [{ author: "priya.shah", body: "I hired ours last year. Happy to share the scorecard we used and what I’d do differently.", kind: "done_myself", daysAgo: 2, hoursAgo: 4 }],
  },
  {
    author: "amara.diallo",
    title: "Has anyone raised a seed round in New York for a hardware-heavy company? 20 minutes on how you pitched it would help.",
    category: "advice",
    daysAgo: 2,
    targetText: "a founder who raised a seed round in New York",
    helpers: [{ helper: "sam.lee", reason: "words", why: "can help with “Raising a seed round in New York; HIPAA basics for first-time founders.”" }],
  },
  {
    author: "lena.fischer",
    title: "Looking for an intro to the supply-chain lead at a US hospital. We are testing a wholesale model for clinic supplies.",
    category: "intro",
    daysAgo: 1,
    hoursAgo: 3,
    targetText: "VP Supply Chain at a US hospital",
    targetCompany: "Mercy Ridge Hospital",
    helpers: [{ helper: "sam.lee", reason: "path", why: "Worked together at Mercy Ridge Hospital", person: "Dana Morris", title: "VP Supply Chain at Mercy Ridge Hospital", warmth: "close" }],
  },
  {
    author: "ada.okafor",
    title: "Looking for a former CFO to review our first board pack before the seed close.",
    category: "advice",
    daysAgo: 4,
    targetText: "a former CFO",
    helpers: [{ helper: "priya.shah", reason: "path", why: "Worked together at Brightline Payments", person: "Nina Patel", title: "Former CFO at Brightline Payments", warmth: "close" }],
    answers: [{ author: "elena.rossi", body: "Not a CFO, but happy to share the board-pack template our investors liked.", daysAgo: 3 }],
  },
  {
    author: "elena.rossi",
    title: "Any advice on getting an EU e-money licence faster? The Bank of Italy asked for a second round of documents.",
    category: "advice",
    daysAgo: 9,
    answeredDaysAgo: 7,
    answers: [{ author: "priya.shah", body: "We went through the UK version. Send the risk framework before they ask for it; it cut our second round to three weeks.", kind: "done_myself", daysAgo: 8 }],
  },
  {
    author: "amara.diallo",
    title: "Looking for a plant manager with cement or ceramics experience, ideally in France.",
    category: "hire",
    daysAgo: 5,
    targetText: "a plant manager in cement",
    pinned: true,
  },
  {
    author: "marcus.webb",
    title: "Who has run a Series B data room recently? I’d like to compare notes on what investors actually opened.",
    category: "advice",
    daysAgo: 6,
    answers: [{ author: "elena.rossi", body: "We did ours in March. Three things got opened: the cohort sheet, the pipeline and the cap table. Happy to talk.", daysAgo: 5 }],
  },
  {
    author: "marcus.webb",
    title: "We moved our data platform off a single cloud: 31% cheaper, no downtime. Happy to share the runbook with anyone doing the same.",
    category: "other",
    kind: "update",
    daysAgo: 2,
    hoursAgo: 6,
  },
  {
    author: "priya.shah",
    title: "Ledgerline is hiring a VP Sales in London. Intros welcome, and thank you to everyone who sent names last month.",
    category: "other",
    kind: "update",
    daysAgo: 7,
  },
];

async function seedAsks(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  const admin = ids.get("maya.ortiz") ?? null;
  for (const seed of ASKS) {
    const createdAt = ago(seed.daysAgo, seed.hoursAgo ?? 0);
    const [created] = await transaction
      .insert(ask)
      .values({
        authorId: ids.get(seed.author) ?? "",
        title: seed.title,
        detail: null,
        category: seed.category,
        kind: seed.kind ?? "ask",
        targetText: seed.targetText ?? null,
        targetCompany: seed.targetCompany ?? null,
        listedAt: createdAt,
        createdAt,
        ...(seed.pinned ? { pinnedAt: createdAt, pinnedByUserId: admin } : {}),
        ...(seed.answeredDaysAgo === undefined ? {} : { closedAt: ago(seed.answeredDaysAgo), outcome: "solved_here" as const }),
      })
      .returning({ id: ask.id });
    if (!created) continue;
    for (const helper of seed.helpers ?? []) {
      await transaction.insert(askHelper).values({
        askId: created.id,
        helperId: ids.get(helper.helper) ?? "",
        reason: helper.reason,
        why: helper.why,
        personName: helper.person ?? null,
        personTitle: helper.title ?? null,
        warmth: helper.warmth ?? null,
        notifiedAt: createdAt,
        createdAt,
      });
    }
    for (const answer of seed.answers ?? []) {
      const answeredAt = ago(answer.daysAgo, answer.hoursAgo ?? 0);
      const authorId = ids.get(answer.author) ?? "";
      await transaction.insert(askAnswer).values({ askId: created.id, authorId, body: answer.body, kind: answer.kind ?? "answer", createdAt: answeredAt });
      if (answer.kind && answer.kind !== "answer") {
        await transaction.insert(askOffer).values({ askId: created.id, helperId: authorId, note: answer.body, seenAt: answeredAt, createdAt: answeredAt });
      }
    }
  }
}

const THREAD: readonly [string, string, number][] = [
  ["priya.shah", "Saw your ask about hospital procurement. I know Dana at Lakeshore Health. Want me to reach out?", 26],
  ["sam.lee", "That would be amazing, thank you! I've sent the intro request with a short note.", 25],
  ["priya.shah", "Got it. I'll forward it this week. Can you send a one-pager I can attach?", 5],
];

async function seedMessages(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  const [low, high] = [ids.get("sam.lee") ?? "", ids.get("priya.shah") ?? ""].sort((first, second) => (first < second ? -1 : first > second ? 1 : 0));
  const [created] = await transaction
    .insert(conversation)
    .values({ memberLowId: low ?? "", memberHighId: high ?? "", lastRevision: THREAD.length, createdAt: ago(1, 26) })
    .returning({ id: conversation.id });
  if (!created) return;
  for (const [index, [sender, body, hoursAgo]] of THREAD.entries()) {
    await transaction.insert(directMessage).values({
      conversationId: created.id,
      senderId: ids.get(sender) ?? "",
      clientKey: randomUUID(),
      body,
      sequence: index + 1,
      revision: index + 1,
      createdAt: ago(0, hoursAgo),
    });
  }
  // Sam has read all but the last message, so the demo opens with one unread.
  await transaction.insert(conversationReadCursor).values([
    { conversationId: created.id, memberId: ids.get("sam.lee") ?? "", lastReadSequence: THREAD.length - 1 },
    { conversationId: created.id, memberId: ids.get("priya.shah") ?? "", lastReadSequence: THREAD.length },
  ]);
}

// The profile fill-in has run for everyone: a portrait and a company logo each. Lena said "Don't look me up", so she
// keeps her initials. Public profiles still list Grace at her last company, so her card (Ledgerline) shows no logo.
const FILL_IN_REFUSED = "lena.fischer";
const FILL_IN_OLDER_COMPANY = { key: "grace.kim", company: "Countwise" } as const;
const FILL_IN_TERMS_DAYS_AGO = 200;
const FILLED_IN_DAYS_AGO = 20;

function toDemoFilledProfile(demoPerson: DemoPerson) {
  const profile = toDemoProfile(demoPerson);
  if (demoPerson.key !== FILL_IN_OLDER_COMPANY.key) return toFilledProfile(profile);
  const { company } = FILL_IN_OLDER_COMPANY;
  return toFilledProfile({
    ...profile,
    work_relevant: { ...profile.work_relevant, company: { name: company, domain: toDemoDomain(company), image_url: toDemoLogoUrl(company) } },
  });
}

async function seedFillIn(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  await saveFillInSettings(transaction, { basis: FILL_IN_BASES.terms, termsDate: ago(FILL_IN_TERMS_DAYS_AGO).toISOString().slice(0, 10) });
  const filledAt = ago(FILLED_IN_DAYS_AGO);
  for (const demoPerson of DEMO_PEOPLE) {
    const userId = ids.get(demoPerson.key) ?? "";
    if (demoPerson.key === FILL_IN_REFUSED) {
      await transaction.insert(memberLookup).values({ userId, refusedAt: filledAt });
      continue;
    }
    await transaction.insert(memberLookup).values({ userId, status: LOOKUP_STATUSES.found, lookedUpAt: filledAt });
    const isCityFilled = demoPerson.key === CITY_FROM_FILL_IN.key;
    const lines = Object.entries(toDemoFilledProfile(demoPerson)).map(([field, value]) => ({
      userId,
      field,
      value,
      filledAt: isCityFilled && field === "location" ? ago(CITY_FROM_FILL_IN.daysAgo) : filledAt,
    }));
    if (lines.length > 0) await transaction.insert(memberFillIn).values(lines);
  }
}

// Four founders linked their hiring tool and a pull found their jobs. The demo's pull never fetches, so they stay.
async function seedJobs(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>, now: Date) {
  for (const seed of DEMO_JOB_SOURCES) {
    const founder = person(seed.founder);
    const [created] = await transaction
      .insert(jobSource)
      .values({
        memberId: ids.get(founder.key) ?? "",
        company: founder.company,
        companySlug: toCompanySlug(founder.company),
        tool: seed.tool,
        slug: seed.slug,
        sourceUrl: toDemoCareersUrl(seed.slug),
        lastPulledAt: ago(0, 1),
        createdAt: ago(seed.linkedDaysAgo),
      })
      .returning({ id: jobSource.id });
    if (!created) continue;
    await transaction.insert(jobPosting).values(
      seed.jobs.map((job, index) => {
        const externalId = `${seed.slug}-${index + 1}`;
        return { sourceId: created.id, externalId, title: job.title, location: job.location, department: job.department, url: toDemoJobUrl(seed.slug, externalId), postedAt: ago(job.postedDaysAgo), updatedAt: now };
      }),
    );
  }
}

async function seedSettings(transaction: Transaction, environment: Environment, ids: Ids, now: Date) {
  await transaction.insert(communityBranding).values({ ...DEMO_COMMUNITY, savedAt: now });
  await saveSettings(transaction, {
    [INSTANCE_SETTING_KEYS.firstAdminUserId]: ids.get("maya.ortiz") ?? "",
    [INSTANCE_SETTING_KEYS.villageGroupId]: DEMO_VILLAGE_GROUP.id,
    [INSTANCE_SETTING_KEYS.villageGroupInviteLink]: DEMO_VILLAGE_GROUP.inviteLink,
    [INSTANCE_SETTING_KEYS.demoSeededAt]: now.toISOString(),
    [INSTANCE_SETTING_KEYS.demoResetAt]: now.toISOString(),
    ...toDataHomeSettings(DEMO_DATA_HOME),
    // The public job board and the website widget are on, so the demo can show them.
    [PUBLIC_BOARD_SETTING]: "on",
  });
  await saveVillageKeys(transaction, DEMO_VILLAGE_KEYS, environment);
  // The features a fund buys it for are on, with made-up jobs and perks; the feed and Slack/Discord stay off.
  for (const manifest of [networkManifest, introsManifest, asksManifest, messagesManifest, jobBoardManifest, perksManifest]) await saveModuleState(transaction, manifest, true);
  for (const manifest of [feedManifest, chatManifest]) await saveModuleState(transaction, manifest, false);
}

export async function seedDemo(transaction: Transaction, environment: Environment, now = new Date()) {
  const ago = makeClock(now);
  const ids = await seedMembers(transaction, ago);
  await seedSettings(transaction, environment, ids, now);
  await seedFillIn(transaction, ids, ago);
  await seedInvites(transaction, ids, ago);
  await seedIntros(transaction, ids, ago);
  await seedAsks(transaction, ids, ago);
  await seedMessages(transaction, ids, ago);
  await seedJobs(transaction, ids, ago, now);
  return { members: DEMO_PEOPLE.length, invites: DEMO_INVITEES.length, intros: CURRENT_INTROS.length + HISTORY_PAIRS.length, asks: ASKS.length };
}
