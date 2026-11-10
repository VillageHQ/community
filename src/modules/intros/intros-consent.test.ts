import { createHash, createHmac } from "node:crypto";

import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as answerRoute from "@/app/api/intros/consent/answer/route";
import { POST as postEmail } from "@/app/api/intros/consent/email/route";
import { POST as postNewLink } from "@/app/api/intros/consent/link/route";
import { POST as postCreate } from "@/app/api/intros/create/route";
import { POST as postDetail } from "@/app/api/intros/detail/route";
import { POST as postBoard } from "@/app/api/intros/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";
import { POST as postBlock } from "@/app/api/members/block/route";
import { POST as postPaths } from "@/app/api/network/paths/route";
import IntroConsentPage, { metadata } from "@/app/meet/[token]/page";
import {
  CONSENT_ANSWERS,
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_STATES,
  introBoardSchema,
  introSchema,
  introWithConsentIssueSchema,
  type ConsentAnswer,
  type Intro,
} from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { sendDueConnectorReminders, sendDueExpiryEmails } from "@/modules/intros/quiet-intro-emails";
import { expireDueIntros } from "@/modules/intros/reads";
import { readIntroReport } from "@/modules/intros/reads-report";
import { sendDueTargetReminders } from "@/modules/intros/target-reminder";
import { sendDueEmails } from "@/platform/email/outbox-sender";
import { introConsentLink, introOptOut, introRequest } from "@/modules/intros/schema";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { networkPathsSchema } from "@/modules/network/contract";
import { adminAuditEntry } from "@/platform/audit/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { user } from "@/platform/database/auth-schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { memberNetwork, memberProfile } from "@/modules/members/schema";
import { saveVillageKeys } from "@/platform/village/settings";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, makeIntroOverdue, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const requestCookie = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: requestCookie.value }), cookies: async () => new Map() }));

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const GONE_STATUS = 410;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_GATEWAY_STATUS = 502;
const SERVER_ERROR_STATUS = 500;
const TOKEN_LENGTH = 43;
const CONCURRENT_ANSWERS = 6;
const EMAIL_SETTLE_MS = 100;
const FAILED_ATTEMPTS_ALLOWED = 10;
const MILLISECONDS_PER_DAY = 86_400_000;
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";
const TARGET_SLUG = "clara-bergstrom";
const OTHER_SLUG = "tomasz-nowak";
const TARGET_EMAIL = "clara@outside.test";
const JONAS_SLUG = "jonas-lindqvist";
const NOOR_SLUG = "noor-haddad";
const AMARA_SLUG = "amara-osei";
const WHY = "We sell freight tools and I'd like twenty minutes.";
const RELATIONSHIP_REASON = "Both worked at Corvane Logistics";
const SAME_SHAPE_UNKNOWN_TOKEN = "A".repeat(TOKEN_LENGTH);
const AMARA_HEADLINE = "Founder, Tidewell";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

const JONAS = { first_name: "Jonas", last_name: "Lindqvist", linkedin_url: `https://www.linkedin.com/in/${JONAS_SLUG}`, headline: "CTO, Ledgerline" };
const NOOR = { first_name: "Noor", last_name: "Haddad", linkedin_url: `https://www.linkedin.com/in/${NOOR_SLUG}` };

function call(handler: Handler, member: Member | null, body: unknown, origin: string | null = APP_URL) {
  return handler(
    new Request(`${APP_URL}/api/intros`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
        ...(member ? { Cookie: member.cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function readDigest(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error ? error.digest : null;
}

describe("double opt-in intros", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let jonas: Member;
  let noor: Member;
  let bystander: Member;
  let admin: Member;

  function configureResend() {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
  }

  async function lookUpPaths(member: Member, slug = TARGET_SLUG) {
    const response = await call(postPaths, member, { linkedinSlug: slug });
    expect(response.status).toBe(OK_STATUS);
    return networkPathsSchema.parse(await response.json());
  }

  async function ask(member: Member = amara, connectorSlug = JONAS_SLUG, targetSlug = TARGET_SLUG) {
    await lookUpPaths(member, targetSlug);
    const response = await call(postCreate, member, { targetSlug, connectorSlug, note: WHY });
    expect(response.status).toBe(OK_STATUS);
    return introSchema.parse(await response.json());
  }

  async function sayYesAsConnector(introId: string, connector: Member = jonas) {
    const response = await call(postTransition, connector, { introId, action: INTRO_ACTIONS.accept });
    expect(response.status).toBe(OK_STATUS);
    const accepted = introWithConsentIssueSchema.parse(await response.json());
    if (!accepted.consentIssue) throw new Error("Expected a consent link.");
    return accepted.consentIssue;
  }

  async function askAndReachTarget(member: Member = amara, connector: Member = jonas, connectorSlug = JONAS_SLUG) {
    const intro = await ask(member, connectorSlug);
    const { token, link } = await sayYesAsConnector(intro.id, connector);
    return { intro, token, link };
  }

  function answer(token: unknown, choice: ConsentAnswer = CONSENT_ANSWERS.yes, member: Member | null = null, origin: string | null = APP_URL) {
    return call(answerRoute.POST, member, { token, answer: choice }, origin);
  }

  async function readLinkHashes(introId: string) {
    const links = await database.select({ tokenHash: introConsentLink.tokenHash }).from(introConsentLink).where(eq(introConsentLink.introId, introId));
    return links.map(({ tokenHash }) => tokenHash);
  }

  async function readAnswer(response: Response) {
    return (await response.json()) as { answer: ConsentAnswer; isRepeat: boolean };
  }

  async function readRow(introId: string) {
    const [row] = await database.select().from(introRequest).where(eq(introRequest.id, introId));
    if (!row) throw new Error("Expected the intro row.");
    return row;
  }

  async function readDetail(member: Member, introId: string) {
    return introSchema.parse(await (await call(postDetail, member, { introId })).json());
  }

  async function renderPage(token: string, viewer: Member | null = null) {
    requestCookie.value = viewer?.cookie ?? "";
    return renderToStaticMarkup(await IntroConsentPage({ params: Promise.resolve({ token }) }));
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    resend = await startFakeResendServer();
    process.env.VILLAGE_API_URL = village.url;
    process.env.VILLAGE_SDK_URL = "https://sdk.village.test";
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    delete process.env.VILLAGE_SDK_URL;
    await village.stop();
    await resend.stop();
    await database.$client.end();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    village.reset();
    resend.reset();
    requestCookie.value = "";
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/invite-code" });
    amara = await createSignedInMember(database);
    jonas = await createSignedInMember(database);
    noor = await createSignedInMember(database);
    bystander = await createSignedInMember(database);
    admin = await createSignedInMember(database, "admin");
    const memberSlugs: [Member, string][] = [
      [amara, AMARA_SLUG],
      [jonas, JONAS_SLUG],
      [noor, NOOR_SLUG],
      [bystander, "bystander"],
    ];
    for (const [member, slug] of memberSlugs) {
      const externalId = await joinMemberToGroup(database, member.userId, slug);
      village.state.linkedMembers.set(externalId, { status: "ready", email: member.email });
    }
    await nameMember(database, amara.userId, "Amara Osei");
    await nameMember(database, jonas.userId, "Jonas Lindqvist");
    await nameMember(database, noor.userId, "Noor Haddad");
    await database.insert(memberProfile).values({ userId: amara.userId, title: "Founder", company: "Tidewell" }).onConflictDoUpdate({
      target: memberProfile.userId,
      set: { title: "Founder", company: "Tidewell" },
    });
    for (const slug of [TARGET_SLUG, OTHER_SLUG]) {
      village.state.pathsByUrl.set(`https://www.linkedin.com/in/${slug}`, {
        summary: "s",
        target: { full_name: slug === TARGET_SLUG ? "Clara Bergström" : "Tomasz Nowak" },
        paths: [
          { degree: 2, description: "d", introducer: JONAS, introducerMeta: [{ title: "Work", description: RELATIONSHIP_REASON }] },
          { degree: 2, description: "d", introducer: NOOR },
        ],
      });
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("the connector's yes", () => {
    it("gives the connector a long private link", async () => {
      const { token, link } = await askAndReachTarget();

      expect(token).toHaveLength(TOKEN_LENGTH);
      expect(link).toBe(`${APP_URL}/meet/${token}`);
    });

    it("stores only a hash of the link", async () => {
      const { intro, token } = await askAndReachTarget();

      const row = await readRow(intro.id);
      const hashes = await readLinkHashes(intro.id);

      expect(hashes).toHaveLength(1);
      expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify([row, hashes])).not.toContain(token);
    });

    it("shows the link only in the connector's own response", async () => {
      const { intro, token } = await askAndReachTarget();

      expect(JSON.stringify(await readDetail(jonas, intro.id))).not.toContain(token);
      expect(JSON.stringify(await readDetail(amara, intro.id))).not.toContain(token);
    });

    it("makes no Village call and spends no credits", async () => {
      const intro = await ask();
      const requestsBefore = village.state.requests.length;

      await sayYesAsConnector(intro.id);

      expect(village.state.requests).toHaveLength(requestsBefore);
    });

    it("contacts nobody by itself, even with email on", async () => {
      configureResend();
      const intro = await ask();
      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(1), EVENTUALLY);

      await sayYesAsConnector(intro.id);
      await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));

      expect(resend.state.emails).toHaveLength(1);
    });

    describe("making a new link", () => {
      it("gives a working link and keeps the one already forwarded working", async () => {
        const { intro, token: oldToken } = await askAndReachTarget();

        const response = await call(postNewLink, jonas, { introId: intro.id });
        const { consentIssue } = introWithConsentIssueSchema.parse(await response.json());

        expect(consentIssue?.token).not.toBe(oldToken);
        expect(await renderPage(oldToken)).toContain("Yes, introduce us");
        expect(await renderPage(consentIssue?.token ?? "")).toContain("Yes, introduce us");
        const first = await answer(oldToken);
        expect(first.status).toBe(OK_STATUS);
        expect(await readAnswer(first)).toEqual({ answer: CONSENT_ANSWERS.yes, isRepeat: false });
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetAgreed);
      });

      it("shows the answer on the other link once one link is used, and changes nothing", async () => {
        const { intro, token: oldToken } = await askAndReachTarget();
        const { consentIssue } = introWithConsentIssueSchema.parse(await (await call(postNewLink, jonas, { introId: intro.id })).json());

        await answer(consentIssue?.token, CONSENT_ANSWERS.noThanks);
        const late = await answer(oldToken, CONSENT_ANSWERS.yes);

        expect(late.status).toBe(OK_STATUS);
        expect(await readAnswer(late)).toEqual({ answer: CONSENT_ANSWERS.noThanks, isRepeat: true });
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetDeclined);
        expect(await renderPage(oldToken)).toContain("You already said no thanks");
      });

      it.each([
        ["the requester", () => amara],
        ["a bystander", () => bystander],
        ["an admin", () => admin],
      ])("answers %s like an unknown ask", async (_label, readMember) => {
        const { intro } = await askAndReachTarget();

        expect((await call(postNewLink, readMember(), { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
      });

      it("refuses a link for an ask that hasn't reached this step", async () => {
        const intro = await ask();

        expect((await call(postNewLink, jonas, { introId: intro.id })).status).toBe(CONFLICT_STATUS);
      });
    });

    it("lets the connector back out, which kills the link", async () => {
      const { intro, token } = await askAndReachTarget();

      await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.decline });

      expect((await answer(token)).status).toBe(GONE_STATUS);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.declined);
    });
  });

  describe("a link preview bot", () => {
    it("changes nothing by opening the page, however often", async () => {
      const { intro, token } = await askAndReachTarget();
      const before = await readRow(intro.id);

      await renderPage(token);
      await renderPage(token);
      await renderPage(token);

      expect(await readRow(intro.id)).toEqual(before);
    });

    it("leaves the link working for the real person", async () => {
      const { token } = await askAndReachTarget();

      await renderPage(token);

      expect((await answer(token)).status).toBe(OK_STATUS);
    });

    it("finds only POST on the answer route", () => {
      expect(Object.keys(answerRoute)).toEqual(["POST"]);
    });

    it("finds buttons, not links, on the page", async () => {
      const { token } = await askAndReachTarget();

      const page = await renderPage(token);

      expect(page).toContain("Yes, introduce us");
      expect(page).not.toMatch(/<a [^>]*href="[^"]*(answer|yes)/i);
    });
  });

  describe("the public page", () => {
    it("shows who is asking, through whom, and what they wrote", async () => {
      const { token } = await askAndReachTarget();

      const page = await renderPage(token);

      expect(page).toContain("Would you like to meet Amara?");
      expect(page).toContain("Amara Osei");
      expect(page).toContain(AMARA_HEADLINE);
      expect(page).toContain("Jonas Lindqvist");
      expect(page).toContain("We sell freight tools");
    });

    it("exposes no other member or network data", async () => {
      const { intro, token } = await askAndReachTarget();

      const page = await renderPage(token);

      for (const secret of [amara.email, jonas.email, amara.userId, jonas.userId, intro.id, RELATIONSHIP_REASON, "CTO, Ledgerline", AMARA_SLUG, JONAS_SLUG, TARGET_SLUG, "Noor"]) {
        expect(page).not.toContain(secret);
      }
    });

    it("renders the note as plain text", async () => {
      const markup = "<script>alert(1)</script> https://evil.test";
      await lookUpPaths(amara);
      const created = introSchema.parse(await (await call(postCreate, amara, { targetSlug: TARGET_SLUG, connectorSlug: JONAS_SLUG, note: markup })).json());
      const { token } = await sayYesAsConnector(created.id);

      const page = await renderPage(token);

      expect(page).not.toContain("<script>alert");
      expect(page).not.toContain('href="https://evil.test');
    });

    it("tells search engines to stay away", () => {
      expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    describe("signed in", () => {
      it("tells the connector the link is for the target, and changes nothing", async () => {
        const { intro, token } = await askAndReachTarget();

        const page = await renderPage(token, jonas);

        expect(page).toContain("This link is for Clara");
        expect(page).not.toContain("Yes, introduce us");
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
      });

      it("tells the requester the same", async () => {
        const { token } = await askAndReachTarget();

        expect(await renderPage(token, amara)).toContain("This link is for Clara");
      });

      it("still lets someone else who happens to be signed in answer", async () => {
        const { token } = await askAndReachTarget();

        expect(await renderPage(token, bystander)).toContain("Yes, introduce us");
        expect((await answer(token, CONSENT_ANSWERS.yes, bystander)).status).toBe(OK_STATUS);
      });

      it.each([
        ["the connector", () => jonas],
        ["the requester", () => amara],
      ])("refuses %s answering for the target", async (_label, readMember) => {
        const { intro, token } = await askAndReachTarget();

        const response = await answer(token, CONSENT_ANSWERS.yes, readMember());

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.consentLinkNotForYou });
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
      });
    });
  });

  describe("hostile tokens", () => {
    it.each([
      ["too short", "abc"],
      ["empty", ""],
      ["the right length with bad characters", `${"!".repeat(TOKEN_LENGTH)}`],
      ["SQL", `' OR 1=1 --${"a".repeat(TOKEN_LENGTH - 11)}`],
      ["a path", `../../${"a".repeat(TOKEN_LENGTH - 6)}`],
      ["a stored hash", "a".repeat(64)],
    ])("closes for %s", async (_label, token) => {
      const { intro } = await askAndReachTarget();

      expect((await answer(token)).status).toBe(GONE_STATUS);
      expect(await renderPage(token)).toContain("This link isn&#x27;t open any more");
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
    });

    it.each([
      ["a long string", "a".repeat(5000)],
      ["an array", ["a"]],
      ["an object", { $ne: null }],
      ["nothing", undefined],
    ])("refuses %s as malformed", async (_label, token) => {
      expect((await answer(token)).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses an unknown answer", async () => {
      const { token } = await askAndReachTarget();

      expect((await call(answerRoute.POST, null, { token, answer: "maybe" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("refuses the hash of a real link used as the token", async () => {
      const { intro } = await askAndReachTarget();
      const [storedHash] = await readLinkHashes(intro.id);

      expect((await answer(storedHash)).status).toBe(GONE_STATUS);
    });

    it("refuses another site, and a request with no origin", async () => {
      const { intro, token } = await askAndReachTarget();

      expect((await answer(token, CONSENT_ANSWERS.yes, null, "https://evil.test")).status).toBe(FORBIDDEN_STATUS);
      expect((await answer(token, CONSENT_ANSWERS.yes, null, null)).status).toBe(FORBIDDEN_STATUS);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
    });

    it("refuses an expired link", async () => {
      const { token, intro } = await askAndReachTarget();
      await makeIntroOverdue(database, intro.id);

      expect((await answer(token)).status).toBe(GONE_STATUS);
      expect(await renderPage(token)).toContain("This link isn&#x27;t open any more");
    });

    it("changes the answer only once, and shows a second tap the first answer", async () => {
      const { intro, token } = await askAndReachTarget();

      expect(await readAnswer(await answer(token))).toEqual({ answer: CONSENT_ANSWERS.yes, isRepeat: false });
      const second = await answer(token, CONSENT_ANSWERS.noThanks);

      expect(second.status).toBe(OK_STATUS);
      expect(await readAnswer(second)).toEqual({ answer: CONSENT_ANSWERS.yes, isRepeat: true });
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetAgreed);
    });

    it("shows a calm page, not a failure, when the link is opened again after a yes", async () => {
      const { token } = await askAndReachTarget();
      await answer(token);

      const page = await renderPage(token);

      expect(page).toContain("You already said yes");
      expect(page).not.toContain("isn&#x27;t open any more");
      expect(page).not.toContain("Yes, introduce us");
    });

    it("shows a stop-all on a second visit", async () => {
      const { token } = await askAndReachTarget();
      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      expect(await renderPage(token)).toContain("You&#x27;ve stopped intro requests");
    });

    it("never counts a second tap on a real link as a failed try", async () => {
      const { token } = await askAndReachTarget();
      await answer(token);

      for (let attempt = 0; attempt <= FAILED_ATTEMPTS_ALLOWED; attempt += 1) {
        expect((await answer(token)).status).toBe(OK_STATUS);
        expect(await renderPage(token)).toContain("You already said yes");
      }
      expect((await answer(SAME_SHAPE_UNKNOWN_TOKEN)).status).toBe(GONE_STATUS);
    });

    it("lands exactly one of many simultaneous answers", async () => {
      const { intro, token } = await askAndReachTarget();
      const choices = Array.from({ length: CONCURRENT_ANSWERS }, (_unused, position) => (position % 2 === 0 ? CONSENT_ANSWERS.yes : CONSENT_ANSWERS.noThanks));

      const responses = await Promise.all(choices.map((choice) => answer(token, choice)));
      const bodies = await Promise.all(responses.map(readAnswer));

      expect(responses.every(({ status }) => status === OK_STATUS)).toBe(true);
      expect(bodies.filter(({ isRepeat }) => !isRepeat)).toHaveLength(1);
      expect(new Set(bodies.map((body) => body.answer)).size).toBe(1);
      expect([INTRO_STATES.targetAgreed, INTRO_STATES.targetDeclined]).toContain((await readRow(intro.id)).state);
    });

    it("keeps the link after the answer, so a second tap can show it", async () => {
      const { intro, token } = await askAndReachTarget();

      await answer(token);

      expect(await readLinkHashes(intro.id)).toHaveLength(1);
    });

    describe("guessing", () => {
      it("slows down after repeated failures", async () => {
        const statuses = [];
        for (let attempt = 0; attempt <= FAILED_ATTEMPTS_ALLOWED; attempt += 1) statuses.push((await answer(SAME_SHAPE_UNKNOWN_TOKEN)).status);

        expect(statuses.at(0)).toBe(GONE_STATUS);
        expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS_STATUS);
      });

      it("slows down the page too", async () => {
        for (let attempt = 0; attempt <= FAILED_ATTEMPTS_ALLOWED; attempt += 1) await answer(SAME_SHAPE_UNKNOWN_TOKEN);

        expect(await renderPage(SAME_SHAPE_UNKNOWN_TOKEN)).toContain("Too many tries");
      });

      it("never locks out a real link", async () => {
        const { token } = await askAndReachTarget();
        for (let attempt = 0; attempt <= FAILED_ATTEMPTS_ALLOWED; attempt += 1) await answer(SAME_SHAPE_UNKNOWN_TOKEN);

        expect((await answer(token)).status).toBe(OK_STATUS);
      });
    });
  });

  describe("the target's yes", () => {
    it("moves on without email, and asks the connector to join them", async () => {
      const { intro, token } = await askAndReachTarget();

      await answer(token);

      expect((await readDetail(jonas, intro.id)).state).toBe(INTRO_STATES.targetAgreed);
      expect((await readDetail(amara, intro.id)).state).toBe(INTRO_STATES.targetAgreed);
      expect(resend.state.emails).toEqual([]);
    });

    it("gives the requester news, and a fresh deadline for the connector", async () => {
      const { intro, token } = await askAndReachTarget();

      await answer(token);
      const detail = await readDetail(amara, intro.id);

      expect(detail.hasUpdate).toBe(true);
      expect(detail.targetAgreedAt).not.toBeNull();
    });

    it("lets the connector finish", async () => {
      const { intro, token } = await askAndReachTarget();
      await answer(token);

      const response = await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.complete });

      expect(introSchema.parse(await response.json()).state).toBe(INTRO_STATES.completed);
    });

    describe("with Resend and an address from the connector", () => {
      async function emailTarget(introId: string, token: string, targetEmail = TARGET_EMAIL) {
        return call(postEmail, jonas, { introId, token, targetEmail });
      }

      it("sends the target the link, without the note", async () => {
        configureResend();
        const { intro, token, link } = await askAndReachTarget();
        await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
        resend.reset();

        expect((await emailTarget(intro.id, token)).status).toBe(OK_STATUS);

        const body = JSON.stringify(resend.state.emails.map(({ body: sent }) => sent));
        expect(body).toContain(TARGET_EMAIL);
        expect(body).toContain(link);
        expect(body).not.toContain("freight");
      });

      describe("the reminder on day 4", () => {
        async function emailedDaysAgo(days: number) {
          configureResend();
          const { intro, token } = await askAndReachTarget();
          expect((await emailTarget(intro.id, token)).status).toBe(OK_STATUS);
          const emailedAt = new Date(Date.now() - days * MILLISECONDS_PER_DAY);
          await database.update(introRequest).set({ consentEmailAt: emailedAt }).where(eq(introRequest.id, intro.id));
          await sendDueEmails(database, process.env);
          resend.reset();
          return { intro, token };
        }

        async function readReminders() {
          await sendDueEmails(database, process.env);
          return resend.state.emails.filter(({ body }) => JSON.stringify(body).includes("only reminder"));
        }

        it("sends nothing before day 4", async () => {
          await emailedDaysAgo(3.9);

          expect(await sendDueTargetReminders(database, process.env)).toEqual({ reminded: 0 });
          expect(await readReminders()).toEqual([]);
        });

        it("sends exactly one, with a link that works, however often the job runs", async () => {
          const { intro } = await emailedDaysAgo(4);

          const runs = await Promise.all([sendDueTargetReminders(database, process.env), sendDueTargetReminders(database, process.env)]);
          await sendDueTargetReminders(database, process.env, new Date(Date.now() + MILLISECONDS_PER_DAY));

          expect(runs.reduce((total, { reminded }) => total + reminded, 0)).toBe(1);
          const reminders = await readReminders();
          expect(reminders).toHaveLength(1);
          const sent = JSON.stringify(reminders[0]?.body);
          expect(sent).toContain(TARGET_EMAIL);
          expect(sent).not.toContain("freight");
          const newToken = sent.match(/\/meet\/([A-Za-z0-9_-]{43})/)?.[1] ?? "";
          expect(await readLinkHashes(intro.id)).toHaveLength(2);
          expect((await answer(newToken)).status).toBe(OK_STATUS);
          expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetAgreed);
        });

        it("sends none once the person answered", async () => {
          const { token } = await emailedDaysAgo(5);
          await answer(token, CONSENT_ANSWERS.noThanks);

          expect(await sendDueTargetReminders(database, process.env)).toEqual({ reminded: 0 });
          expect(await readReminders()).toEqual([]);
        });
      });

      it("joins them with one email to both, then closes as introduced", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);
        resend.reset();

        await answer(token);

        await vi.waitFor(async () => expect((await readRow(intro.id)).state).toBe(INTRO_STATES.completed), EVENTUALLY);
        const joining = resend.state.emails.filter(({ body }) => JSON.stringify(body).includes(TARGET_EMAIL));
        expect(joining).toHaveLength(1);
        expect(JSON.stringify(joining)).toContain(amara.email);
        expect(JSON.stringify(joining)).toContain("freight");
      });

      it("gives every email about the yes its own idempotency key, so Resend sends them all", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);
        resend.reset();

        await answer(token);

        await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThanOrEqual(2), EVENTUALLY);
        await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));
        const keys = resend.state.emails.map(({ idempotencyKey }) => String(idempotencyKey));
        expect(new Set(keys).size).toBe(keys.length);
      });

      it("keeps the address of an earlier email that went out when a later one fails", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);
        const longAgo = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY);
        await database.update(introRequest).set({ consentEmailAt: longAgo }).where(eq(introRequest.id, intro.id));
        resend.state.failureStatus = SERVER_ERROR_STATUS;
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect((await emailTarget(intro.id, token, "clara.second@outside.test")).status).toBe(BAD_GATEWAY_STATUS);

        const row = await readRow(intro.id);
        expect(row.targetEmail).toBe(TARGET_EMAIL);
        expect(row.consentEmailAt?.getTime()).toBe(longAgo.getTime());
      });

      it("deletes the address once they're joined", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);

        await answer(token);

        await vi.waitFor(async () => expect((await readRow(intro.id)).targetEmail).toBeNull(), EVENTUALLY);
      });

      it("never shows the address to the requester", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);

        expect(await (await call(postDetail, amara, { introId: intro.id })).text()).not.toContain(TARGET_EMAIL);
      });

      it("falls back to the connector when the joining email fails", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);
        resend.state.failureStatus = SERVER_ERROR_STATUS;
        const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect((await answer(token)).status).toBe(OK_STATUS);

        await vi.waitFor(() => expect(logged).toHaveBeenCalled(), EVENTUALLY);
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetAgreed);
      });

      it("deletes the address when the target says no", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);

        await answer(token, CONSENT_ANSWERS.noThanks);

        expect((await readRow(intro.id)).targetEmail).toBeNull();
      });

      it("reports a failed send, and keeps nothing", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        resend.state.failureStatus = SERVER_ERROR_STATUS;
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const response = await emailTarget(intro.id, token);

        expect(response.status).toBe(BAD_GATEWAY_STATUS);
        expect((await readRow(intro.id)).targetEmail).toBeNull();
      });

      it("keeps the target's address and answer when they said yes while the email was failing", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        resend.state.failureStatus = SERVER_ERROR_STATUS;
        const sendStarted = Promise.withResolvers<void>();
        const answered = Promise.withResolvers<void>();
        const realFetch = globalThis.fetch;
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
          if (String(input instanceof Request ? input.url : input).includes("/emails")) {
            sendStarted.resolve();
            await answered.promise;
          }
          return realFetch(input, init);
        });

        const emailing = emailTarget(intro.id, token);
        await sendStarted.promise;
        await database.update(introRequest).set({ state: INTRO_STATES.targetAgreed, targetAgreedAt: new Date() }).where(eq(introRequest.id, intro.id));
        answered.resolve();

        expect((await emailing).status).toBe(BAD_GATEWAY_STATUS);
        const row = await readRow(intro.id);
        expect(row.state).toBe(INTRO_STATES.targetAgreed);
        expect(row.targetEmail).toBe(TARGET_EMAIL);
      });

      it("sends at most one a day", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        await emailTarget(intro.id, token);

        expect((await emailTarget(intro.id, token)).status).toBe(CONFLICT_STATUS);
      });

      it.each([
        ["an old link", SAME_SHAPE_UNKNOWN_TOKEN],
        ["a bad link", "nope"],
      ])("refuses %s", async (_label, staleToken) => {
        configureResend();
        const { intro } = await askAndReachTarget();

        expect((await emailTarget(intro.id, staleToken)).status).toBe(CONFLICT_STATUS);
      });

      it("refuses a member's own address", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();

        expect((await emailTarget(intro.id, token, jonas.email)).status).toBe(UNPROCESSABLE_STATUS);
        expect((await emailTarget(intro.id, token, amara.email)).status).toBe(UNPROCESSABLE_STATUS);
      });

      it.each([
        ["the requester", () => amara],
        ["a bystander", () => bystander],
      ])("refuses %s", async (_label, readMember) => {
        configureResend();
        const { intro, token } = await askAndReachTarget();

        expect((await call(postEmail, readMember(), { introId: intro.id, token, targetEmail: TARGET_EMAIL })).status).toBe(NOT_FOUND_STATUS);
      });

      it("makes no Village call to do it", async () => {
        configureResend();
        const { intro, token } = await askAndReachTarget();
        const requestsBefore = village.state.requests.length;

        await emailTarget(intro.id, token);

        expect(village.state.requests).toHaveLength(requestsBefore);
      });
    });

    it("refuses an email when Resend isn't configured", async () => {
      const { intro, token } = await askAndReachTarget();

      const response = await call(postEmail, jonas, { introId: intro.id, token, targetEmail: TARGET_EMAIL });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect((await readRow(intro.id)).targetEmail).toBeNull();
    });

    it("tells the requester and the connector by email when Resend is on, without any address for the target", async () => {
      configureResend();
      const { token } = await askAndReachTarget();
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
      resend.reset();

      await answer(token);

      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      const body = JSON.stringify(resend.state.emails.map(({ body: sent }) => sent));
      expect(body).toContain(amara.email);
      expect(body).toContain(jonas.email);
    });
  });

  describe("the privacy of a no", () => {
    function readRequesterFacts(intro: Intro) {
      return { state: intro.state, declineReason: intro.declineReason, declineKind: intro.declineKind, askedTargetAt: intro.askedTargetAt, acceptedAt: intro.acceptedAt, targetAgreedAt: intro.targetAgreedAt };
    }

    it("shows the requester the same thing for a connector's no and a target's no", async () => {
      const fromConnector = await ask(amara, NOOR_SLUG);
      await call(postTransition, noor, { introId: fromConnector.id, action: INTRO_ACTIONS.decline, reason: "Private thoughts" });
      const { intro: fromTarget, token } = await askAndReachTarget(amara, jonas, JONAS_SLUG);
      await answer(token, CONSENT_ANSWERS.noThanks);

      const connectorNo = await readDetail(amara, fromConnector.id);
      const targetNo = await readDetail(amara, fromTarget.id);

      expect(readRequesterFacts(connectorNo)).toEqual(readRequesterFacts(targetNo));
      expect(connectorNo.state).toBe(INTRO_STATES.declined);
    });

    it("shows nothing at all to the requester when the connector says yes", async () => {
      const intro = await ask();
      const before = await (await call(postDetail, amara, { introId: intro.id })).text();

      await sayYesAsConnector(intro.id);

      expect(await (await call(postDetail, amara, { introId: intro.id })).text()).toBe(before);
    });

    it("hides a late yes from the deadline the requester sees", async () => {
      const intro = await ask();
      await database.update(introRequest).set({ expiresAt: new Date(Date.now() + MILLISECONDS_PER_DAY) }).where(eq(introRequest.id, intro.id));

      await sayYesAsConnector(intro.id);

      expect((await readDetail(amara, intro.id)).expiresAt).toBe(intro.expiresAt);
    });

    it("hides the connector's yes from the open ask on the paths panel", async () => {
      const { intro } = await askAndReachTarget();

      const { connectors } = await lookUpPaths(amara);

      expect(connectors.find(({ linkedinSlug }) => linkedinSlug === JONAS_SLUG)?.openAsk).toEqual({ id: intro.id, state: INTRO_STATES.requested });
    });

    it("lets the requester withdraw after a connector's yes, so a refusal can't give it away", async () => {
      const { intro, token } = await askAndReachTarget();

      const response = await call(postTransition, amara, { introId: intro.id, action: INTRO_ACTIONS.withdraw });

      expect(response.status).toBe(OK_STATUS);
      expect((await answer(token)).status).toBe(GONE_STATUS);
    });

    it("shows the requester an expiry the same way wherever the ask stopped", async () => {
      const stalled = await ask(amara, NOOR_SLUG);
      const { intro: reachedTarget } = await askAndReachTarget();
      await makeIntroOverdue(database, stalled.id);
      await makeIntroOverdue(database, reachedTarget.id);

      const atConnector = await readDetail(amara, stalled.id);
      const atTarget = await readDetail(amara, reachedTarget.id);

      expect(readRequesterFacts(atConnector)).toEqual(readRequesterFacts(atTarget));
      expect(atTarget.state).toBe(INTRO_STATES.expired);
    });

    it("kills the link when the ask expires for a member", async () => {
      const { intro, token } = await askAndReachTarget();
      await makeIntroOverdue(database, intro.id);

      await readDetail(amara, intro.id);

      expect((await answer(token)).status).toBe(GONE_STATUS);
    });

    it("emails the requester without saying who answered", async () => {
      configureResend();
      const { token } = await askAndReachTarget();
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
      resend.reset();

      await answer(token, CONSENT_ANSWERS.noThanks);

      await vi.waitFor(() => expect(resend.state.emails).toHaveLength(2), EVENTUALLY);
      const toRequester = resend.state.emails.filter(({ body }) => JSON.stringify(body).includes(amara.email));
      expect(toRequester).toHaveLength(1);
      expect(JSON.stringify(toRequester)).not.toMatch(/said no|Jonas|passed/);
    });

    it("tells the connector what the target said", async () => {
      const { intro, token } = await askAndReachTarget();

      await answer(token, CONSENT_ANSWERS.noThanks);

      expect((await readDetail(jonas, intro.id)).state).toBe(INTRO_STATES.targetDeclined);
    });

    describe("what follows a target's no", () => {
      it("closes the requester's other asks for that target", async () => {
        const { token, intro } = await askAndReachTarget();
        const other = await ask(amara, NOOR_SLUG);

        await answer(token, CONSENT_ANSWERS.noThanks);

        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetDeclined);
        expect((await readRow(other.id)).isWithheld).toBe(true);
        expect((await call(postDetail, noor, { introId: other.id })).status).toBe(NOT_FOUND_STATUS);
      });

      it("withholds a new ask from the same requester, with the same answer as always", async () => {
        const { token } = await askAndReachTarget();
        await answer(token, CONSENT_ANSWERS.noThanks);

        const again = await ask(amara, NOOR_SLUG);

        expect(again.state).toBe(INTRO_STATES.requested);
        expect((await readRow(again.id)).isWithheld).toBe(true);
        expect(introBoardSchema.parse(await (await call(postBoard, noor, {})).json()).asksForYou).toEqual([]);
      });

      it("leaves other members' asks for that target alone", async () => {
        const { token } = await askAndReachTarget();
        await answer(token, CONSENT_ANSWERS.noThanks);

        const fromNoor = await ask(noor, JONAS_SLUG);

        expect((await readRow(fromNoor.id)).isWithheld).toBe(false);
      });
    });
  });

  describe("stopping all asks", () => {
    it("closes this ask and saves only a hash of who stopped them", async () => {
      const { intro, token } = await askAndReachTarget();

      expect((await answer(token, CONSENT_ANSWERS.stopAllAsks)).status).toBe(OK_STATUS);

      const optOuts = await database.select().from(introOptOut);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.targetDeclined);
      expect(optOuts).toHaveLength(1);
      expect(JSON.stringify(optOuts)).not.toContain(TARGET_SLUG);
      expect(JSON.stringify(optOuts)).not.toContain("Clara");
    });

    it("can't be reversed by hashing a guessed slug without the app's secret", async () => {
      const { token } = await askAndReachTarget();

      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      const [optOut] = await database.select().from(introOptOut);
      const plainHashes = [TARGET_SLUG, `intro-opt-out:${TARGET_SLUG}`].map((value) => createHash("sha256").update(value).digest("hex"));
      expect(optOut?.targetSlugHash).toMatch(/^[0-9a-f]{64}$/);
      expect(plainHashes).not.toContain(optOut?.targetSlugHash);
      const withOtherSecret = createHmac("sha256", "another-secret").update(`intro-opt-out:${TARGET_SLUG}`).digest("hex");
      expect(optOut?.targetSlugHash).not.toBe(withOtherSecret);
    });

    it("stops asks waiting at other connectors, from any member", async () => {
      const { token } = await askAndReachTarget();
      const waiting = await ask(noor, JONAS_SLUG);

      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      expect((await call(postDetail, jonas, { introId: waiting.id })).status).toBe(NOT_FOUND_STATUS);
      expect((await readDetail(noor, waiting.id)).state).toBe(INTRO_STATES.requested);
    });

    it("closes links other connectors already issued, which then show the stop", async () => {
      const { token } = await askAndReachTarget();
      const secondIntro = await ask(noor, JONAS_SLUG);
      const second = await sayYesAsConnector(secondIntro.id);

      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      expect(await readAnswer(await answer(second.token))).toEqual({ answer: CONSENT_ANSWERS.stopAllAsks, isRepeat: true });
      expect((await readRow(secondIntro.id)).state).toBe(INTRO_STATES.targetDeclined);
    });

    it("withholds every later ask, without telling the requester", async () => {
      const { token } = await askAndReachTarget();
      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      const later = await ask(noor, JONAS_SLUG);

      expect(later.state).toBe(INTRO_STATES.requested);
      expect(JSON.stringify(later)).not.toMatch(/withheld|opt/i);
      expect((await call(postDetail, jonas, { introId: later.id })).status).toBe(NOT_FOUND_STATUS);
      expect((await call(postTransition, jonas, { introId: later.id, action: INTRO_ACTIONS.accept })).status).toBe(NOT_FOUND_STATUS);
    });

    it("leaves asks for other people alone", async () => {
      const { token } = await askAndReachTarget();
      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      const other = await ask(amara, JONAS_SLUG, OTHER_SLUG);

      expect((await readRow(other.id)).isWithheld).toBe(false);
    });

    it("refuses a connector's yes that raced past the stop", async () => {
      const raced = await ask(noor, JONAS_SLUG);
      const { token } = await askAndReachTarget();
      await answer(token, CONSENT_ANSWERS.stopAllAsks);
      await database.update(introRequest).set({ isWithheld: false }).where(eq(introRequest.id, raced.id));

      const response = await call(postTransition, jonas, { introId: raced.id, action: INTRO_ACTIONS.accept });

      expect(response.status).toBe(NOT_FOUND_STATUS);
      expect((await readRow(raced.id)).isWithheld).toBe(true);
    });

    it("audits the stop with no name attached", async () => {
      const { token } = await askAndReachTarget();

      await answer(token, CONSENT_ANSWERS.stopAllAsks);

      const entries = await database.select().from(adminAuditEntry);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ action: AUDIT_ACTIONS.introAsksStopped, actorId: null, targetName: null, detail: null });
      expect(JSON.stringify(entries)).not.toMatch(/Clara|Amara|Jonas/);
    });

    it("audits nothing for a plain yes or no", async () => {
      const first = await askAndReachTarget();
      await answer(first.token);

      expect(await database.select().from(adminAuditEntry)).toEqual([]);
    });
  });

  describe("block rules", () => {
    function block(blocker: Member, blocked: Member) {
      return call(postBlock, blocker, { memberId: blocked.userId, isBlocked: true });
    }

    async function reachState(state: string) {
      const intro = await ask();
      if (state === INTRO_STATES.requested) return { intro, token: null };
      if (state === INTRO_STATES.accepted) {
        await database.update(introRequest).set({ state: INTRO_STATES.accepted, acceptedAt: new Date() }).where(eq(introRequest.id, intro.id));
        return { intro, token: null };
      }
      const { token } = await sayYesAsConnector(intro.id);
      if (state === INTRO_STATES.askingTarget) return { intro, token };
      await answer(token);
      return { intro, token: null };
    }

    describe.each([INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed])("in %s", (state) => {
      describe("when the connector blocks the requester", () => {
        it("takes it off their list and stops them acting", async () => {
          const { intro } = await reachState(state);

          await block(jonas, amara);

          expect(introBoardSchema.parse(await (await call(postBoard, jonas, {})).json()).asksForYou).toEqual([]);
          expect((await call(postDetail, jonas, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
          expect((await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.complete })).status).toBe(NOT_FOUND_STATUS);
          expect((await call(postNewLink, jonas, { introId: intro.id })).status).toBe(NOT_FOUND_STATUS);
        });

        it("changes nothing the requester can see", async () => {
          const { intro } = await reachState(state);
          const before = await (await call(postDetail, amara, { introId: intro.id })).text();

          await block(jonas, amara);

          expect(await (await call(postDetail, amara, { introId: intro.id })).text()).toBe(before);
        });
      });

      describe("when the requester blocks the connector", () => {
        it("stops it reaching the connector's actions", async () => {
          const { intro } = await reachState(state);

          await block(amara, jonas);

          expect((await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.complete })).status).toBeGreaterThanOrEqual(CONFLICT_STATUS - 5);
          expect([INTRO_STATES.withdrawn, state]).toContain((await readRow(intro.id)).state);
        });

        it("says nothing about a block", async () => {
          const { intro } = await reachState(state);

          await block(amara, jonas);

          const response = await call(postDetail, jonas, { introId: intro.id });
          expect(await response.text()).not.toMatch(/block/i);
        });
      });
    });

    describe("while the target holds the link", () => {
      it("closes the link when the connector blocks the requester", async () => {
        const { intro, token } = await reachState(INTRO_STATES.askingTarget);

        await block(jonas, amara);

        expect(token).not.toBeNull();
        expect(await renderPage(token ?? "")).toContain("This link isn&#x27;t open any more");
        expect((await answer(token)).status).toBe(GONE_STATUS);
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
      });

      it("closes the link when the requester blocks the connector", async () => {
        const { intro, token } = await reachState(INTRO_STATES.askingTarget);

        await block(amara, jonas);

        expect((await answer(token)).status).toBe(GONE_STATUS);
        expect((await readRow(intro.id)).state).toBe(INTRO_STATES.withdrawn);
        });

      it("stays closed after an unblock", async () => {
        const { token } = await reachState(INTRO_STATES.askingTarget);
        await block(jonas, amara);
        await call(postBlock, jonas, { memberId: amara.userId, isBlocked: false });

        expect((await answer(token)).status).toBe(GONE_STATUS);
      });

      it.each([
        ["a banned requester", () => amara],
        ["a banned connector", () => jonas],
      ])("closes for %s", async (_label, readMember) => {
        const { token } = await reachState(INTRO_STATES.askingTarget);

        await database.update(user).set({ banned: true }).where(eq(user.id, readMember().userId));

        expect((await answer(token)).status).toBe(GONE_STATUS);
      });

      it.each([
        ["a requester who left the group", () => amara],
        ["a connector who left the group", () => jonas],
      ])("closes for %s", async (_label, readMember) => {
        const { token } = await reachState(INTRO_STATES.askingTarget);

        await database.update(memberNetwork).set({ groupJoinedAt: null }).where(eq(memberNetwork.userId, readMember().userId));

        expect((await answer(token)).status).toBe(GONE_STATUS);
      });

      it("disappears when the requester is removed", async () => {
        const { token } = await reachState(INTRO_STATES.askingTarget);

        await database.delete(user).where(eq(user.id, amara.userId));

        expect((await answer(token)).status).toBe(GONE_STATUS);
      });
    });

    it("sends no joining email after a block lands first", async () => {
      configureResend();
      const { intro, token } = await reachState(INTRO_STATES.askingTarget);
      await call(postEmail, jonas, { introId: intro.id, token, targetEmail: TARGET_EMAIL });
      resend.reset();

      await block(jonas, amara);
      await answer(token);
      await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));

      expect(resend.state.emails).toEqual([]);
    });
  });

  describe("a forwarded link, when the app has no address for the person asked", () => {
    const FORWARDED_EMAIL = "clara.forwarded@outside.test";

    function answerYesWithEmail(token: string, targetEmail: string) {
      return call(answerRoute.POST, null, { token, answer: CONSENT_ANSWERS.yes, targetEmail });
    }

    it("asks for their email on the yes page when email is on", async () => {
      configureResend();
      const { token } = await askAndReachTarget();

      expect(await renderPage(token)).toContain("Your email");
    });

    it("doesn't ask for an email when the community sends none", async () => {
      const { token } = await askAndReachTarget();

      expect(await renderPage(token)).not.toContain("Your email");
    });

    it("joins them with one email to both, tells the connector, and counts the intro as made", async () => {
      configureResend();
      const { intro, token } = await askAndReachTarget();
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
      resend.reset();

      expect((await answerYesWithEmail(token, FORWARDED_EMAIL)).status).toBe(OK_STATUS);

      await vi.waitFor(async () => expect((await readRow(intro.id)).state).toBe(INTRO_STATES.completed), EVENTUALLY);
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThanOrEqual(2), EVENTUALLY);
      await new Promise((resolve) => setTimeout(resolve, EMAIL_SETTLE_MS));
      const joining = resend.state.emails.filter(({ body }) => JSON.stringify(body).includes(FORWARDED_EMAIL));
      expect(joining).toHaveLength(1);
      expect(JSON.stringify(joining)).toContain(amara.email);
      const toConnector = resend.state.emails.filter(({ body }) => JSON.stringify(body).includes(jonas.email));
      expect(JSON.stringify(toConnector)).toContain("they're connected");
      expect((await readRow(intro.id)).targetEmail).toBeNull();
      expect((await readIntroReport(database, { from: null, to: null })).introduced).toBe(1);
    });

    it("refuses the asker's or the connector's own address", async () => {
      configureResend();
      const { intro, token } = await askAndReachTarget();

      expect((await answerYesWithEmail(token, amara.email)).status).toBe(UNPROCESSABLE_STATUS);
      expect((await answerYesWithEmail(token, jonas.email)).status).toBe(UNPROCESSABLE_STATUS);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
    });

    it("keeps the address the connector already gave", async () => {
      configureResend();
      const { intro, token } = await askAndReachTarget();
      await call(postEmail, jonas, { introId: intro.id, token, targetEmail: TARGET_EMAIL });
      resend.reset();

      await answerYesWithEmail(token, FORWARDED_EMAIL);

      await vi.waitFor(async () => expect((await readRow(intro.id)).state).toBe(INTRO_STATES.completed), EVENTUALLY);
      const body = JSON.stringify(resend.state.emails.map(({ body: sent }) => sent));
      expect(body).toContain(TARGET_EMAIL);
      expect(body).not.toContain(FORWARDED_EMAIL);
    });
  });

  describe("an intro nobody answers", () => {
    async function readSentTo(email: string) {
      await sendDueEmails(database, process.env);
      return resend.state.emails.filter(({ body }) => JSON.stringify((body as { to?: unknown }).to).includes(email));
    }

    async function askedDaysAgo(days: number) {
      configureResend();
      const intro = await ask();
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
      await database.update(introRequest).set({ createdAt: new Date(Date.now() - days * MILLISECONDS_PER_DAY) }).where(eq(introRequest.id, intro.id));
      await sendDueEmails(database, process.env);
      resend.reset();
      return intro;
    }

    it("reminds the connector nothing before day 4", async () => {
      await askedDaysAgo(3.9);

      expect(await sendDueConnectorReminders(database, process.env)).toEqual({ reminded: 0 });
      expect(await readSentTo(jonas.email)).toEqual([]);
    });

    it("reminds the connector exactly once, however often the job runs", async () => {
      await askedDaysAgo(4);

      const runs = await Promise.all([sendDueConnectorReminders(database, process.env), sendDueConnectorReminders(database, process.env)]);
      await sendDueConnectorReminders(database, process.env, new Date(Date.now() + MILLISECONDS_PER_DAY));

      expect(runs.reduce((total, { reminded }) => total + reminded, 0)).toBe(1);
      const reminders = await readSentTo(jonas.email);
      expect(reminders).toHaveLength(1);
      expect(JSON.stringify(reminders[0]?.body)).toContain("only reminder");
      expect(JSON.stringify(reminders[0]?.body)).toContain("Amara");
      expect(await readSentTo(amara.email)).toEqual([]);
    });

    it("sends the connector no reminder once they answered", async () => {
      const intro = await askedDaysAgo(5);
      await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.accept });

      expect(await sendDueConnectorReminders(database, process.env)).toEqual({ reminded: 0 });
    });

    it("sends the asker one kind email when it expires, without saying who didn't answer", async () => {
      const intro = await askedDaysAgo(1);
      await makeIntroOverdue(database, intro.id);

      await expireDueIntros(database, null);
      await call(postBoard, amara, {});
      await Promise.all([sendDueExpiryEmails(database, process.env), sendDueExpiryEmails(database, process.env)]);
      await sendDueExpiryEmails(database, process.env);

      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.expired);
      const toAsker = await readSentTo(amara.email);
      expect(toAsker).toHaveLength(1);
      const sent = JSON.stringify(toAsker[0]?.body);
      expect(sent).toContain("Clara");
      expect(sent).not.toContain("Jonas");
      expect(await readSentTo(jonas.email)).toEqual([]);
    });

    it("sends the asker one email when it expires while the person asked never answered", async () => {
      configureResend();
      const { intro } = await askAndReachTarget();
      await vi.waitFor(() => expect(resend.state.emails.length).toBeGreaterThan(0), EVENTUALLY);
      await sendDueEmails(database, process.env);
      resend.reset();
      await makeIntroOverdue(database, intro.id);

      await call(postBoard, amara, {});
      await sendDueExpiryEmails(database, process.env);

      expect(await readSentTo(amara.email)).toHaveLength(1);
    });
  });

  describe("a connector who said no", () => {
    it("leaves the asker's paths to that person", async () => {
      const intro = await ask();
      await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.decline, reason: null });

      const names = (await lookUpPaths(amara)).connectors.map(({ name }) => name);

      expect(names).not.toContain("Jonas Lindqvist");
      expect(names).toContain("Noor Haddad");
    });

    it("still shows for other people, and for other askers", async () => {
      const intro = await ask();
      await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.decline, reason: null });

      expect((await lookUpPaths(amara, OTHER_SLUG)).connectors.map(({ name }) => name)).toContain("Jonas Lindqvist");
      expect((await lookUpPaths(bystander)).connectors.map(({ name }) => name)).toContain("Jonas Lindqvist");
    });
  });

  describe("a link answered no thanks, opened again after a later stop-all", () => {
    it("shows the no thanks given on it, and the stop as a later step", async () => {
      const first = await askAndReachTarget();
      await answer(first.token, CONSENT_ANSWERS.noThanks);
      const later = await askAndReachTarget(noor);
      await answer(later.token, CONSENT_ANSWERS.stopAllAsks);

      expect(await readAnswer(await answer(first.token))).toEqual({ answer: CONSENT_ANSWERS.noThanks, isRepeat: true });
      const page = await renderPage(first.token);
      expect(page).toContain("You said no thanks");
      expect(page).toContain("Later, you stopped all intro requests");
      expect(await renderPage(later.token)).toContain("You&#x27;ve stopped intro requests");
    });
  });

  describe("with intros turned off", () => {
    it("answers 404 and leaves the ask alone", async () => {
      const { intro, token } = await askAndReachTarget();
      await saveModuleState(database, introsManifest, false);

      expect((await answer(token)).status).toBe(NOT_FOUND_STATUS);
      expect((await readRow(intro.id)).state).toBe(INTRO_STATES.askingTarget);
    });

    it("shows no page", async () => {
      const { token } = await askAndReachTarget();
      await saveModuleState(database, introsManifest, false);

      const rendering = IntroConsentPage({ params: Promise.resolve({ token }) });

      await expect(rendering.catch(readDigest)).resolves.toBe(NOT_FOUND_DIGEST);
    });

    it("still applies a block, so turning it back on can't revive a link", async () => {
      const { token } = await askAndReachTarget();
      await saveModuleState(database, introsManifest, false);

      await call(postBlock, jonas, { memberId: amara.userId, isBlocked: true });
      await saveModuleState(database, introsManifest, true);

      expect((await answer(token)).status).toBe(GONE_STATUS);
    });

    it("works again when it's back on", async () => {
      const { token } = await askAndReachTarget();
      await saveModuleState(database, introsManifest, false);
      await saveModuleState(database, introsManifest, true);

      expect((await answer(token)).status).toBe(OK_STATUS);
    });
  });
});
