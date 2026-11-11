import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as answerRoute from "@/app/api/intros/consent/answer/route";
import { POST as postEmail } from "@/app/api/intros/consent/email/route";
import { POST as postCreate } from "@/app/api/intros/create/route";
import { POST as postDetail } from "@/app/api/intros/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";
import { CONSENT_ANSWERS, INTRO_ACTIONS, INTRO_ERROR_CODES, INTRO_STATES, introBoardSchema, introSchema, introWithConsentIssueSchema } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { expireDueIntros } from "@/modules/intros/reads";
import { readIntroReport } from "@/modules/intros/reads-report";
import { introRequest } from "@/modules/intros/schema";
import { CHOICE_PLACES } from "@/modules/members/contract-privacy";
import { saveIntroAsksAnswer } from "@/modules/members/service-privacy";
import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

const session = vi.hoisted(() => ({ cookie: "" }));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: session.cookie }), cookies: async () => new Map() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const CLARA_EMAIL = "clara@outside.example.com";
const WHY = "We sell freight tools and I'd like twenty minutes.";
const CLARA = { name: "Clara Bergström", company: "Corvane Logistics", email: CLARA_EMAIL, linkedin: null };

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member | null, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/intros`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, ...(member ? { Cookie: member.cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

function renderTree(tree: ReactNode) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, tree));
}

describe("an intro asked from a profile, with Village off", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let jonas: Member;

  function askJonas(target: unknown = CLARA, member: Member = amara) {
    return call(postCreate, member, { connectorId: jonas.userId, target, note: WHY });
  }

  async function askedIntro(target: unknown = CLARA) {
    const response = await askJonas(target);
    expect(response.status).toBe(OK_STATUS);
    return introSchema.parse(await response.json());
  }

  async function readRow(introId: string) {
    const [row] = await database.select().from(introRequest).where(eq(introRequest.id, introId));
    if (!row) throw new Error("Expected the intro row.");
    return row;
  }

  async function readJonasBoard() {
    return introBoardSchema.parse(await (await call(postDetail, jonas, {})).json());
  }

  beforeAll(async () => {
    resend = await startFakeResendServer();
  });

  afterAll(async () => {
    await resend.stop();
    await database.$client.end();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    resend.reset();
    session.cookie = "";
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    await saveModuleState(database, networkManifest, false);
    amara = await createSignedInMember(database);
    jonas = await createSignedInMember(database);
    await nameMember(database, amara.userId, "Amara Osei");
    await nameMember(database, jonas.userId, "Jonas Lindqvist");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("goes from the ask to one joining email, and the partner report counts it", async () => {
    const intro = await askedIntro();
    expect(intro.state).toBe(INTRO_STATES.requested);
    expect(intro.target).toEqual({ name: CLARA.name, headline: CLARA.company, linkedinSlug: null, isNamed: true });

    const [forJonas] = (await readJonasBoard()).asksForYou;
    expect(forJonas?.suggestedTargetEmail).toBe(CLARA_EMAIL);

    const accepted = introWithConsentIssueSchema.parse(await (await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.accept })).json());
    const token = accepted.consentIssue?.token ?? "";
    expect((await call(postEmail, jonas, { introId: intro.id, token, targetEmail: CLARA_EMAIL })).status).toBe(OK_STATUS);
    resend.reset();

    expect((await call(answerRoute.POST, null, { token, answer: CONSENT_ANSWERS.yes })).status).toBe(OK_STATUS);

    await vi.waitFor(async () => expect((await readRow(intro.id)).state).toBe(INTRO_STATES.completed), EVENTUALLY);
    const joining = resend.state.emails.filter(({ body }) => JSON.stringify(body).includes(CLARA_EMAIL));
    expect(joining).toHaveLength(1);
    expect(JSON.stringify(joining)).toContain(amara.email);
    const row = await readRow(intro.id);
    expect([row.targetEmail, row.suggestedTargetEmail]).toEqual([null, null]);
    expect(await readIntroReport(database, { from: null, to: null })).toMatchObject({ asked: 1, introduced: 1 });
  });

  it("stays open although nobody joined the network", async () => {
    const intro = await askedIntro();

    await expireDueIntros(database, null);

    expect((await readRow(intro.id)).state).toBe(INTRO_STATES.requested);
  });

  it("keeps a LinkedIn link as the person's slug", async () => {
    const intro = await askedIntro({ ...CLARA, email: null, linkedin: "https://www.linkedin.com/in/clara-bergstrom/" });

    expect(intro.target.linkedinSlug).toBe("clara-bergstrom");
  });

  it("clears the asker's address when the connector says no", async () => {
    const intro = await askedIntro();

    await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.decline });

    expect((await readRow(intro.id)).suggestedTargetEmail).toBeNull();
  });

  it("withholds a second ask for someone who said no thanks", async () => {
    const intro = await askedIntro();
    const accepted = introWithConsentIssueSchema.parse(await (await call(postTransition, jonas, { introId: intro.id, action: INTRO_ACTIONS.accept })).json());
    await call(answerRoute.POST, null, { token: accepted.consentIssue?.token, answer: CONSENT_ANSWERS.noThanks });

    const again = await askedIntro({ ...CLARA, name: " clara  bergström ", company: "CORVANE LOGISTICS" });

    expect((await readRow(again.id)).isWithheld).toBe(true);
  });

  it("refuses a member's own address for the person", async () => {
    const response = await askJonas({ ...CLARA, email: jonas.email });

    expect(response.status).toBe(UNPROCESSABLE_STATUS);
  });

  it("refuses a member who doesn't take intro asks", async () => {
    await saveIntroAsksAnswer(database, jonas.userId, false, CHOICE_PLACES.yourData);

    const response = await askJonas();

    expect(response.status).toBe(CONFLICT_STATUS);
    expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.notTakingAsks });
  });

  it("refuses a path ask while the network is off", async () => {
    const response = await call(postCreate, amara, { targetSlug: "clara-bergstrom", connectorSlug: "jonas-lindqvist", note: WHY });

    expect(response.status).toBe(CONFLICT_STATUS);
    expect(await response.json()).toMatchObject({ code: INTRO_ERROR_CODES.networkOff });
  });

  describe("the member's profile", () => {
    async function renderJonasProfile() {
      session.cookie = amara.cookie;
      const { default: MemberProfilePage } = await import("@/app/(app)/members/[memberId]/page");
      return renderTree(await MemberProfilePage({ params: Promise.resolve({ memberId: jonas.userId }) }));
    }

    it("offers the ask", async () => {
      expect(await renderJonasProfile()).toContain("Ask Jonas for an intro");
    });

    it("hides the ask with intros off", async () => {
      await saveModuleState(database, introsManifest, false);

      expect(await renderJonasProfile()).not.toContain("Ask Jonas for an intro");
    });

    it("shows who they can introduce only while the network is on", async () => {
      expect(await renderJonasProfile()).not.toContain("Who Jonas can introduce you to");

      await saveModuleState(database, networkManifest, true);
      expect(await renderJonasProfile()).toContain("Jonas hasn&#x27;t shared a network yet");

      await joinMemberToGroup(database, jonas.userId, "jonas-lindqvist");
      const page = await renderJonasProfile();
      expect(page).toContain("Who Jonas can introduce you to");
      expect(page).toContain("network is shared with");
    });
  });
});
