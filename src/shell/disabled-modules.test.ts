import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as dismissReport } from "@/app/api/admin/reports/dismiss/route";
import { POST as listReports } from "@/app/api/admin/reports/list/route";
import { POST as leaveGroup } from "@/app/api/network/leave/route";
import { REPORT_FILTERS, REPORT_TARGETS, reportPageSchema } from "@/modules/admin/contract";
import { contentReport } from "@/modules/admin/schema";
import { feedManifest } from "@/modules/feed/manifest";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { ONBOARDING_STEPS } from "@/modules/members/contract-profile";
import { readNetworkProgress } from "@/modules/network/reads-progress";
import { ROUTES } from "@/platform/http/routes";
import { networkManifest } from "@/modules/network/manifest";
import { saveModuleState } from "@/platform/modules/enablement";
import { NAVIGATION_SECTIONS } from "@/platform/modules/manifest";
import { saveVillageGroup } from "@/modules/network/service-settings";
import { saveVillageKeys } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedPost } from "@/test/feed";
import { FAKE_VILLAGE_KEYS } from "@/test/fake-village-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { readAdminTabFacts } from "./admin-badges";
import { parseSetupStep, readSetupProgress, SETUP_STEPS } from "./admin-setup";
import { readEnabledIds, readRunsOnVillage } from "./enabled-modules";
import { selectNavigationItems } from "./navigation";
import { readNavigationBadges } from "./navigation-badges";
import { selectNextSteps } from "./next-steps";
import { resolveOnboardingStep } from "./onboarding";
import { SetupChecklist } from "./setup-checklist";

const APP_URL = "http://localhost:3000";
const ENVIRONMENT = { APP_URL };

function postJson(path: string, cookie: string, body: unknown) {
  return new Request(`${APP_URL}${path}`, {
    method: "POST",
    headers: { origin: APP_URL, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("the shell with modules off", () => {
  const database = createTestDatabase();

  beforeEach(async () => {
    await clearDatabase(database);
    vi.stubEnv("APP_URL", APP_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await database.$client.end();
  });

  describe("with network off", () => {
    beforeEach(async () => {
      await saveModuleState(database, networkManifest, false);
    });

    it("asks for no Village setup", async () => {
      const { steps } = await readSetupProgress(database);

      expect(steps.map(({ id }) => id)).toEqual([SETUP_STEPS.brand, SETUP_STEPS.invite, SETUP_STEPS.report]);
    });

    describe("a request for a Village setup step", () => {
      it("is refused, however it's asked for", async () => {
        const { steps } = await readSetupProgress(database);

        expect(parseSetupStep(SETUP_STEPS.group, steps.map(({ id }) => id))).toBeNull();
      });

      it("calls Village for nothing, even with keys saved", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const admin = await createSignedInMember(database, "admin");
        await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
        const progress = await readSetupProgress(database);

        await SetupChecklist({ database, admin: { id: admin.userId, email: admin.email, role: "admin" }, progress, openStepId: SETUP_STEPS.group, basePath: "/admin" });

        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    it("hides the network and intros entries", async () => {
      const enabledIds = await readEnabledIds(database);
      const labels = selectNavigationItems(NAVIGATION_SECTIONS.primary, false, enabledIds).map(({ label }) => label);

      expect(labels).toEqual(["Home", "Messages", "Members", "Asks"]);
    });

    it("hides the credits tab", async () => {
      expect((await readAdminTabFacts(database, ENVIRONMENT)).hiddenTabHrefs).toEqual(["/admin/credits"]);
    });

    it("doesn't count an out-of-credits notice", async () => {
      const { recordVillageOutOfCredits } = await import("@/platform/village/settings");
      await recordVillageOutOfCredits(database);

      expect((await readAdminTabFacts(database, ENVIRONMENT)).creditsBadge).toBe(0);
    });

    it("says nothing needs Village", async () => {
      expect(readRunsOnVillage(await readEnabledIds(database))).toBe(false);
    });

    it("skips the network step of onboarding", async () => {
      const { memberProfile } = await import("@/modules/members/schema");
      const member = await createSignedInMember(database);
      await database.insert(memberProfile).values({ userId: member.userId, cardStepDoneAt: new Date() });

      expect(await resolveOnboardingStep(database, { id: member.userId, email: member.email })).toBe("done");
    });

    it("still lets a member leave the Village group", async () => {
      const member = await createSignedInMember(database);
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
      await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/invite-code" });

      const response = await leaveGroup(postJson("/api/network/leave", member.cookie, { confirmed: true }));

      expect(response.status).not.toBe(404);
    });
  });

  describe("the first Village step of setup", () => {
    it("offers to run without Village", async () => {
      const admin = await createSignedInMember(database, "admin");
      const progress = await readSetupProgress(database);

      const checklist = await SetupChecklist({ database, admin: { id: admin.userId, email: admin.email, role: "admin" }, progress, openStepId: SETUP_STEPS.keys, basePath: "/admin" });

      expect(renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, checklist))).toContain("Run without Village");
    });
  });

  describe("a member who finishes onboarding while network is off", () => {
    it("is prompted to sync when network comes back", async () => {
      const { memberProfile } = await import("@/modules/members/schema");
      const member = await createSignedInMember(database);
      const session = { id: member.userId, email: member.email };
      await database.insert(memberProfile).values({ userId: member.userId, cardStepDoneAt: new Date(), onboardingCompletedAt: new Date() });
      await saveVillageKeys(database, FAKE_VILLAGE_KEYS);

      await saveModuleState(database, networkManifest, false);
      expect(await resolveOnboardingStep(database, session)).toBe(ONBOARDING_STEPS.done);

      await saveModuleState(database, networkManifest, true);
      const [nextStep] = selectNextSteps({
        setupProgress: null,
        networkProgress: await readNetworkProgress(database, session),
        communityName: "Northwind",
        isCardFilled: true,
        confirmationCopy: describeEmailConfirmation("Northwind", false),
      });

      expect(nextStep?.isUrgent).toBe(true);
      expect(nextStep?.action?.href).toBe(ROUTES.network);
    });
  });

  describe("with the feed off", () => {
    beforeEach(async () => {
      await saveModuleState(database, feedManifest, false);
    });

    it("keeps a way home in the navigation", async () => {
      const enabledIds = await readEnabledIds(database);
      const [first] = selectNavigationItems(NAVIGATION_SECTIONS.primary, false, enabledIds);

      expect(first?.label).toBe("Home");
    });

    describe("a report on a post", () => {
      async function seedReport() {
        const admin = await createSignedInMember(database, "admin");
        const author = await createSignedInMember(database);
        const reporter = await createSignedInMember(database);
        const postId = await seedPost(database, { authorId: author.userId });
        const [report] = await database
          .insert(contentReport)
          .values({ targetType: REPORT_TARGETS.post, targetId: postId, reporterId: reporter.userId, reportedMemberId: author.userId, body: "A seeded post", contentCreatedAt: new Date() })
          .returning({ id: contentReport.id });
        return { admin, reportId: report?.id ?? "" };
      }

      it("stays visible to admins", async () => {
        const { admin, reportId } = await seedReport();

        const response = await listReports(postJson("/api/admin/reports/list", admin.cookie, { filter: REPORT_FILTERS.open, page: 1 }));
        const { reports } = reportPageSchema.parse(await response.json());

        expect(reports.map(({ id }) => id)).toEqual([reportId]);
      });

      it("still counts toward the admin badge", async () => {
        await seedReport();

        const { admin } = await readNavigationBadges(database, ENVIRONMENT);

        expect(admin).toBeGreaterThanOrEqual(1);
        expect((await readAdminTabFacts(database, ENVIRONMENT)).reportsBadge).toBe(1);
      });

      it("can still be resolved", async () => {
        const { admin, reportId } = await seedReport();

        const response = await dismissReport(postJson("/api/admin/reports/dismiss", admin.cookie, { reportId, targetType: REPORT_TARGETS.post }));

        expect(response.status).toBe(200);
      });
    });
  });
});
