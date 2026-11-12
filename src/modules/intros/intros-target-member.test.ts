import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postCreate } from "@/app/api/intros/create/route";
import { FlashProvider } from "@/components/flash";
import { POST as postMemberAnswer } from "@/app/api/intros/consent/member-answer/route";
import { POST as postTransition } from "@/app/api/intros/transition/route";
import { IntrosList } from "@/modules/intros/components/intros-list";
import { CONSENT_ANSWERS, INTRO_ACTIONS, INTRO_STATES, introSchema } from "@/modules/intros/contract";
import { introsModule } from "@/modules/intros/integration";
import { readIntroBoard } from "@/modules/intros/reads";
import { readIntrosForTarget } from "@/modules/intros/reads-target-member";
import { introRequest } from "@/modules/intros/schema";
import { memberNetwork } from "@/modules/members/schema";
import { networkManifest } from "@/modules/network/manifest";
import { user } from "@/platform/database/auth-schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { EVENTUALLY } from "@/test/async-timeouts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY, startFakeResendServer } from "@/test/fake-resend-server";
import { nameMember } from "@/test/intros";
import { createSignedInMember } from "@/test/signed-in-member";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const GONE_STATUS = 410;
const WHY = "We sell freight tools and would like twenty minutes.";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/intros`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

// INTRO-06: when the person asked for is a member, they see the ask in the app and answer there.
describe("a member who is the person asked for", () => {
  const database = createTestDatabase();
  let resend: Awaited<ReturnType<typeof startFakeResendServer>>;
  let amara: Member;
  let jonas: Member;
  let marcus: Member;
  let bystander: Member;

  async function ask(target: Record<string, unknown>) {
    const created = await call(postCreate, amara, { connectorId: jonas.userId, target: { name: "Marcus Webb", company: "Corvane", email: null, linkedin: null, ...target }, note: WHY });
    expect(created.status).toBe(OK_STATUS);
    return introSchema.parse(await created.json()).id;
  }

  async function askAndAccept(target: Record<string, unknown>) {
    const introId = await ask(target);
    expect((await call(postTransition, jonas, { introId, action: INTRO_ACTIONS.accept })).status).toBe(OK_STATUS);
    return introId;
  }

  async function readState(introId: string) {
    const [row] = await database.select({ state: introRequest.state }).from(introRequest).where(eq(introRequest.id, introId));
    return row?.state;
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
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.com>");
    vi.stubEnv("RESEND_API_URL", resend.url);
    await saveModuleState(database, networkManifest, false);
    [amara, jonas, marcus, bystander] = await Promise.all([createSignedInMember(database), createSignedInMember(database), createSignedInMember(database), createSignedInMember(database)]);
    await nameMember(database, amara.userId, "Amara Osei");
    await nameMember(database, jonas.userId, "Jonas Lindqvist");
    await nameMember(database, marcus.userId, "Marcus Webb");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sees the ask on Your intros once the connector says yes, and says yes there", async () => {
    const introId = await ask({ email: marcus.email });
    // Before the connector's yes, the person hears nothing.
    expect(await readIntrosForTarget(database, marcus.userId)).toEqual([]);
    await call(postTransition, jonas, { introId, action: INTRO_ACTIONS.accept });

    const [forMarcus] = await readIntrosForTarget(database, marcus.userId);
    expect(forMarcus).toMatchObject({ id: introId, introducerName: "Jonas Lindqvist", requester: { name: "Amara Osei" } });
    expect(JSON.stringify(forMarcus)).not.toContain(amara.email);
    expect(await introsModule.readNavigationBadge?.(database, marcus.userId)).toBe(1);
    const list = createElement(IntrosList, { board: await readIntroBoard(database, marcus.userId), allowance: { left: 5, cap: 5 }, forYou: [forMarcus!] });
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(FlashProvider, null, list as ReactNode)));
    expect(html).toContain("Jonas Lindqvist would like to introduce you to Amara Osei");
    expect(html).toContain("Yes, introduce us");

    const answered = await call(postMemberAnswer, marcus, { introId, answer: CONSENT_ANSWERS.yes });
    expect(answered.status).toBe(OK_STATUS);
    expect(await answered.json()).toEqual({ answer: CONSENT_ANSWERS.yes, isRepeat: false });
    // Joined by one email to Marcus's own address.
    await vi.waitFor(async () => expect(await readState(introId)).toBe(INTRO_STATES.completed), EVENTUALLY);
    expect(JSON.stringify(resend.state.emails)).toContain(marcus.email);
    expect(await readIntrosForTarget(database, marcus.userId)).toEqual([]);
  });

  it("can say no thanks there, and can't answer twice", async () => {
    const introId = await askAndAccept({ email: marcus.email });

    expect((await call(postMemberAnswer, marcus, { introId, answer: CONSENT_ANSWERS.noThanks })).status).toBe(OK_STATUS);

    expect(await readState(introId)).toBe(INTRO_STATES.targetDeclined);
    expect((await call(postMemberAnswer, marcus, { introId, answer: CONSENT_ANSWERS.yes })).status).toBe(GONE_STATUS);
  });

  it("is matched by a confirmed LinkedIn too, never by a claim nobody confirmed", async () => {
    await database.insert(memberNetwork).values({ userId: marcus.userId, linkedinSlug: "marcus-webb" });
    const introId = await askAndAccept({ linkedin: "https://www.linkedin.com/in/marcus-webb/" });
    expect(await readIntrosForTarget(database, marcus.userId)).toEqual([]);

    await database.update(memberNetwork).set({ linkedinConfirmedSlug: "marcus-webb" }).where(eq(memberNetwork.userId, marcus.userId));

    expect((await readIntrosForTarget(database, marcus.userId)).map(({ id }) => id)).toEqual([introId]);
  });

  it("never shows the ask to another member, nor to one whose address isn't verified, and they can't answer it", async () => {
    const introId = await askAndAccept({ email: marcus.email });
    await database.update(user).set({ emailVerified: false }).where(eq(user.id, marcus.userId));

    expect(await readIntrosForTarget(database, marcus.userId)).toEqual([]);
    expect(await readIntrosForTarget(database, bystander.userId)).toEqual([]);
    expect((await call(postMemberAnswer, bystander, { introId, answer: CONSENT_ANSWERS.yes })).status).toBe(GONE_STATUS);
    expect((await call(postMemberAnswer, amara, { introId, answer: CONSENT_ANSWERS.yes })).status).toBe(GONE_STATUS);
    expect(await readState(introId)).toBe(INTRO_STATES.askingTarget);
  });
});
