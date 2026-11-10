import "server-only";

import { randomUUID } from "node:crypto";

import { ask, askAnswer, askHelper, askOffer } from "@/modules/asks/schema";
import { asksManifest } from "@/modules/asks/manifest";
import { chatManifest } from "@/modules/chat/manifest";
import { feedManifest } from "@/modules/feed/manifest";
import { introRequest } from "@/modules/intros/schema";
import { introsManifest } from "@/modules/intros/manifest";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { invite, memberNetwork, memberProfile, memberTag } from "@/modules/members/schema";
import { createInviteToken, hashInviteToken } from "@/modules/members/service-invite-token";
import { messagesManifest } from "@/modules/messages/manifest";
import { conversation, conversationReadCursor, directMessage } from "@/modules/messages/schema";
import { networkManifest } from "@/modules/network/manifest";
import { perksManifest } from "@/modules/perks/manifest";
import { user } from "@/platform/database/auth-schema";
import type { Transaction } from "@/platform/database/client";
import { communityBranding } from "@/platform/branding/schema";
import { DEMO_COMMUNITY, DEMO_DATA_HOME, DEMO_INVITEES, DEMO_OUTSIDERS, DEMO_PEOPLE, toDemoEmail, toDemoSlug, type DemoPerson } from "@/platform/demo/people";
import { DEMO_VILLAGE_GROUP, DEMO_VILLAGE_KEYS } from "@/platform/demo/village-answers";
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
      location: demoPerson.location,
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
  {
    requester: "tomas.novak",
    introducer: "sam.lee",
    target: "luca-bianchi-demo",
    state: "requested",
    daysAgo: 0,
    reason: "Sam and Luca were in the same accelerator batch.",
    note: "Sam, Luca runs insurance operations at Assicura Nord. We're looking for a design partner for claims documents. Would you introduce us?",
  },
  {
    requester: "ravi.menon",
    introducer: "sam.lee",
    target: "alex-morgan-demo",
    state: "accepted",
    daysAgo: 9,
    reason: "Sam hired Alex's team for a sales workshop.",
    note: "Sam, Alex is the VP Sales I mentioned at the dinner. Would love a warm intro while we're hiring a US head of sales.",
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

type AskSeed = {
  author: string;
  title: string;
  detail: string;
  category: (typeof ask.$inferInsert)["category"];
  kind?: "ask" | "update";
  daysAgo: number;
  target?: string;
  closed?: { daysAgo: number; outcome: "solved_here" | "solved_elsewhere" | "no_longer_needed" };
  offers?: readonly [string, string][];
  answers?: readonly [string, string][];
  helpers?: readonly [string, string][];
};

const ASKS: readonly AskSeed[] = [
  {
    author: "sam.lee",
    title: "Intro to procurement at a US hospital group",
    detail: "Two pilots are live with outpatient clinics. We're ready for a hospital group in the Northeast and need someone who can open the procurement door.",
    category: "intro",
    daysAgo: 2,
    target: "dana-whitfield-demo",
    offers: [
      ["priya.shah", "I know Dana from a panel last spring. Happy to make the intro once you send a two-line blurb."],
      ["ravi.menon", "Not Dana, but I know the CIO at another hospital group in Boston. Want that one too?"],
    ],
    answers: [["oliver.grant", "We sold to NHS trusts: get a clinical champion first, procurement follows. Happy to share our champion email."]],
  },
  {
    author: "priya.shah",
    title: "VP Sales who has sold to finance teams",
    detail: "London-based, has carried a quota selling to CFOs or controllers at mid-size companies. First sales leader at Ledgerline.",
    category: "hire",
    daysAgo: 4,
    offers: [["marcus.webb", "Our old head of sales at Brightwater sold to finance teams before us. I'll ask if she's looking."]],
    helpers: [
      ["sam.lee", "Sam can help with first sales hires."],
      ["grace.kim", "Grace works at Ledgerline."],
    ],
  },
  {
    author: "amara.diallo",
    title: "Plant manager with cement or ceramics experience",
    detail: "Our first plant opens in France next year. Looking for someone who has run a kiln line.",
    category: "hire",
    daysAgo: 6,
    helpers: [["sam.lee", "Sam's network has people in industrial operations."]],
  },
  {
    author: "diego.alvarez",
    title: "Intro to a large food cooperative",
    detail: "Campo's sensors cut water use by a fifth on olive farms. A cooperative could roll it out to hundreds of members at once.",
    category: "customer",
    daysAgo: 8,
    target: "mei-chen-demo",
    offers: [["lena.fischer", "I stock Harbor Foods products in Berlin and know their supply-chain team."]],
  },
  {
    author: "noah.berg",
    title: "Angel investors who know the Nordics",
    detail: "Raising a small pre-seed for Fjordpay. Looking for angels who have built or backed payments companies in Norway or Sweden.",
    category: "intro",
    daysAgo: 3,
    target: "jonas-lind-demo",
    helpers: [["sam.lee", "Sam raised from a Nordic angel last year."]],
  },
  {
    author: "tomas.novak",
    title: "How did you price your developer API?",
    detail: "We're choosing between per-document and per-seat pricing. Would love to hear what worked for others.",
    category: "advice",
    daysAgo: 5,
    answers: [
      ["ravi.menon", "Usage-based with a free tier worked for us. Charge per document, cap the first invoice so nobody gets a shock."],
      ["sam.lee", "We started per-seat and regretted it. Our buyers wanted to pay for outcomes."],
    ],
  },
  {
    author: "zara.ahmed",
    title: "Clearpath is live with its first two banks",
    detail: "Thanks to everyone who helped with intros in the spring. Both banks signed annual contracts this month.",
    category: "other",
    kind: "update",
    daysAgo: 1,
  },
  {
    author: "elena.rossi",
    title: "A bank partner in Spain",
    detail: "Cashwell is expanding to Spain and needs a bank partner for card settlement.",
    category: "intro",
    daysAgo: 45,
    target: "sara-lopez-demo",
    closed: { daysAgo: 30, outcome: "solved_here" },
    offers: [["diego.alvarez", "Sara at Banco Meridia banks half the farms we work with. Intro sent!"]],
  },
  {
    author: "lena.fischer",
    title: "Head of growth who knows German retail",
    detail: "Corner Grocer needs someone who has grown a B2B app with independent shops.",
    category: "hire",
    daysAgo: 70,
    closed: { daysAgo: 50, outcome: "solved_elsewhere" },
  },
];

async function seedAsks(transaction: Transaction, ids: Ids, ago: ReturnType<typeof makeClock>) {
  for (const seed of ASKS) {
    const target = seed.target ? outsider(seed.target) : null;
    const createdAt = ago(seed.daysAgo, 2);
    const [created] = await transaction
      .insert(ask)
      .values({
        authorId: ids.get(seed.author) ?? "",
        title: seed.title,
        detail: seed.detail,
        category: seed.category,
        kind: seed.kind ?? "ask",
        targetSlug: target?.slug ?? null,
        targetName: target?.name ?? null,
        listedAt: createdAt,
        createdAt,
        ...(seed.closed ? { closedAt: ago(seed.closed.daysAgo), outcome: seed.closed.outcome } : {}),
      })
      .returning({ id: ask.id });
    if (!created) continue;
    for (const [index, [helper, note]] of (seed.offers ?? []).entries()) {
      await transaction.insert(askOffer).values({ askId: created.id, helperId: ids.get(helper) ?? "", note, createdAt: new Date(createdAt.getTime() + (index + 1) * 5 * HOUR_MS) });
    }
    for (const [index, [author, body]] of (seed.answers ?? []).entries()) {
      await transaction.insert(askAnswer).values({ askId: created.id, authorId: ids.get(author) ?? "", body, createdAt: new Date(createdAt.getTime() + (index + 1) * 7 * HOUR_MS) });
    }
    for (const [helper, why] of seed.helpers ?? []) {
      await transaction.insert(askHelper).values({ askId: created.id, helperId: ids.get(helper) ?? "", reason: "words", why, createdAt });
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

async function seedSettings(transaction: Transaction, environment: Environment, ids: Ids, now: Date) {
  await transaction.insert(communityBranding).values({ ...DEMO_COMMUNITY, savedAt: now });
  await saveSettings(transaction, {
    [INSTANCE_SETTING_KEYS.firstAdminUserId]: ids.get("maya.ortiz") ?? "",
    [INSTANCE_SETTING_KEYS.villageGroupId]: DEMO_VILLAGE_GROUP.id,
    [INSTANCE_SETTING_KEYS.villageGroupInviteLink]: DEMO_VILLAGE_GROUP.inviteLink,
    [INSTANCE_SETTING_KEYS.demoSeededAt]: now.toISOString(),
    [INSTANCE_SETTING_KEYS.demoResetAt]: now.toISOString(),
    ...toDataHomeSettings(DEMO_DATA_HOME),
  });
  await saveVillageKeys(transaction, DEMO_VILLAGE_KEYS, environment);
  // The features a fund buys it for are on; the ones that need a real outside account stay off.
  for (const manifest of [networkManifest, introsManifest, asksManifest, messagesManifest]) await saveModuleState(transaction, manifest, true);
  for (const manifest of [feedManifest, jobBoardManifest, perksManifest, chatManifest]) await saveModuleState(transaction, manifest, false);
}

export async function seedDemo(transaction: Transaction, environment: Environment, now = new Date()) {
  const ago = makeClock(now);
  const ids = await seedMembers(transaction, ago);
  await seedSettings(transaction, environment, ids, now);
  await seedInvites(transaction, ids, ago);
  await seedIntros(transaction, ids, ago);
  await seedAsks(transaction, ids, ago);
  await seedMessages(transaction, ids, ago);
  return { members: DEMO_PEOPLE.length, invites: DEMO_INVITEES.length, intros: CURRENT_INTROS.length + HISTORY_PAIRS.length, asks: ASKS.length };
}
