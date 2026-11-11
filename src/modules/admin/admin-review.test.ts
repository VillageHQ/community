import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { adminAuditEntry } from "@/platform/audit/schema";
import { contentReport } from "@/modules/admin/schema";
import { memberRemoval, invite, memberNetwork } from "@/modules/members/schema";
import { session, user } from "@/platform/database/auth-schema";
import { communityBranding } from "@/platform/branding/schema";
import { getDatabase } from "@/platform/database/client";
import { post } from "@/modules/feed/schema";
import { instanceSettings, INSTANCE_SETTING_KEYS } from "@/platform/settings/schema";
import { conversation, directMessage, messageReport } from "@/modules/messages/schema";
import { memberDailyUsage } from "@/platform/village/schema";
import { memberPathResult } from "@/modules/network/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { CONTENT_CHOICES, memberPageSchema, REPORT_TARGETS, reportPageSchema } from "@/modules/admin/contract";
import {
  departureResponseSchema,
  GROUP_DEPARTURE_OUTCOMES,
  NETWORK_ERROR_CODES,
  networkPathsSchema,
} from "@/modules/network/contract";
import { MEMBER_ROLES } from "@/platform/auth/roles";
import { describeCreditEstimate, estimateCreditCost, readCreditUsage } from "@/modules/network/reads-credits";
import { REPORT_SAVED_MESSAGES } from "@/modules/admin/service-reports";
import { setDailyLookupLimit, saveVillageGroup, readVillageGroup } from "@/modules/network/service-settings";
import { issuedInviteSchema } from "@/modules/members/contract-invites";
import { createInvite, revokeInvite } from "@/modules/members/service-invites";
import { reinviteRemovedMember } from "@/modules/admin/service-roster";
import { confirmMemberEmail } from "@/modules/members/service-admin";
import { createRequestContext } from "@/platform/http/request-context";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { readDailyLookupLimit, saveVillageKeys, readVillageOutOfCreditsAt } from "@/platform/village/settings";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedPost } from "@/test/feed";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { seedConversation, seedMessages } from "@/test/messages";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postAccept } from "@/app/api/invites/accept/route";
import { DELETE as deleteLogoRoute, POST as postLogo } from "@/app/api/branding/logo/route";
import { POST as postFeedReport } from "@/app/api/feed/report/route";
import { POST as postMessageReport } from "@/app/api/messages/report/route";
import { POST as postThread } from "@/app/api/messages/thread/route";
import { POST as postPaths } from "@/app/api/network/paths/route";
import { POST as postSearch } from "@/app/api/network/search/route";
import { POST as postBranding } from "@/app/api/admin/branding/route";
import { POST as postDailyLimit } from "@/app/api/admin/credits/limit/route";
import { POST as postReclaim } from "@/app/api/admin/invites/reclaim/route";
import { POST as postRevoke } from "@/app/api/admin/invites/revoke/route";
import { POST as postInvite } from "@/app/api/admin/invites/route";
import { POST as postLeaveGroup } from "@/app/api/admin/members/leave-group/route";
import { POST as postMemberList } from "@/app/api/admin/members/list/route";
import { POST as postReinvite } from "@/app/api/admin/members/reinvite/route";
import { POST as postRemove } from "@/app/api/admin/members/remove/route";
import { POST as postReportDismiss } from "@/app/api/admin/reports/dismiss/route";
import { POST as postReportList } from "@/app/api/admin/reports/list/route";
import { POST as postVillageKeys } from "@/app/api/admin/village/keys/route";
import { POST as postLinkReset } from "@/app/api/admin/village/links/reset/route";
import { saveModuleState } from "@/platform/modules/enablement";
import { feedManifest } from "@/modules/feed/manifest";
import { readInviteToken } from "@/test/invite-link";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const FORBIDDEN_STATUS = 403;
const INTERNAL_ERROR_STATUS = 500;
const CONFLICT_STATUS = 409;
const RACE_ROUNDS = 5;
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const LEAVE_PATH = "/v2/groups/leave";
const SEARCH_PATH = "/v2/people/search";
const PASSWORD = "a-long-new-password";

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Route = (request: Request) => Promise<Response>;

function jsonRequest(cookie: string | null, body: unknown) {
  return new Request(`${APP_URL}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function logoRequest(cookie: string, method = "POST", body: BodyInit | null = PNG_BYTES) {
  return new Request(`${APP_URL}/api/branding/logo`, {
    method,
    headers: { "Content-Type": "image/png", Origin: APP_URL, Cookie: cookie },
    body,
  });
}

describe("the review fixes", () => {
  const database = createTestDatabase();
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;
  let admin: Member;
  let member: Member;

  function send(route: Route, actor: Member, body: unknown) {
    return route(jsonRequest(actor.cookie, body));
  }

  async function readAuditActions() {
    const rows = await database.select({ action: adminAuditEntry.action, detail: adminAuditEntry.detail }).from(adminAuditEntry);
    return rows.map(({ action }) => action);
  }

  async function readExternalId(memberId: string) {
    const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, memberId));
    return network?.villageExternalId ?? "";
  }

  async function setUpVillage() {
    await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
    await saveVillageGroup(database, { id: "group-1", inviteLink: "https://village.test/join/x" });
  }

  async function joinAndLink(target: Member, slug = "mo") {
    await joinMemberToGroup(database, target.userId, slug);
    const externalId = await readExternalId(target.userId);
    village.state.linkedMembers.set(externalId, { status: "ready", email: target.email });
    return externalId;
  }

  async function remove(target: Member, contentChoice: string = CONTENT_CHOICES.keep) {
    return send(postRemove, admin, { memberId: target.userId, contentChoice });
  }

  async function readRemovalOutcome(memberId: string) {
    const [removal] = await database.select().from(memberRemoval).where(eq(memberRemoval.userId, memberId));
    return removal?.villageLeaveOutcome ?? null;
  }

  beforeAll(async () => {
    village = await startFakeVillageServer();
    process.env.VILLAGE_API_URL = village.url;
  });

  afterAll(async () => {
    delete process.env.VILLAGE_API_URL;
    await village.stop();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    // The feed starts off for a new community. These tests are about a community that has it on.
    await saveModuleState(database, feedManifest, true);
    await database.delete(communityBranding);
    village.reset();
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
    await nameMember(database, admin.userId, "Ada Admin");
    await nameMember(database, member.userId, "Mo Member");
  });

  describe("Village's real error bodies", () => {
    beforeEach(async () => {
      await setUpVillage();
      await joinAndLink(member);
    });

    it("reads a real out-of-credits answer, tells the member plainly, and notifies admins", async () => {
      village.state.failures.set(SEARCH_PATH, { status: 402, type: "ignored" });

      const response = await send(postSearch, member, { prompt: "founders" });
      const body = await response.json();

      expect(body.code).toBe(NETWORK_ERROR_CODES.outOfCredits);
      expect(body.message).toContain("run out of Village credits");
      expect(await readVillageOutOfCreditsAt(database)).not.toBeNull();
    });

    it("doesn't burn a lookup on a real out-of-credits answer", async () => {
      village.state.failures.set(SEARCH_PATH, { status: 402, type: "ignored" });

      await send(postSearch, member, { prompt: "founders" });

      const [usage] = await database.select().from(memberDailyUsage).where(eq(memberDailyUsage.userId, member.userId));
      expect(usage?.callCount).toBe(0);
      expect(usage?.searchCount).toBe(0);
    });

    it("reads a real rate-limit answer the same way, and burns no lookup", async () => {
      village.state.failures.set(SEARCH_PATH, { status: 429, type: "ignored" });

      const response = await send(postSearch, member, { prompt: "founders" });

      expect((await response.json()).code).toBe(NETWORK_ERROR_CODES.rateLimited);
      const [usage] = await database.select().from(memberDailyUsage).where(eq(memberDailyUsage.userId, member.userId));
      expect(usage?.callCount).toBe(0);
    });
  });

  describe("an audit write that fails", () => {
    const BLOCK_AUDIT = "block_audit_writes";

    beforeEach(async () => {
      await database.execute(sql`alter table admin_audit_entry add constraint ${sql.identifier(BLOCK_AUDIT)} check (false) not valid`);
    });

    afterEach(async () => {
      await database.execute(sql`alter table admin_audit_entry drop constraint ${sql.identifier(BLOCK_AUDIT)}`);
    });

    it("rolls back a new daily limit", async () => {
      expect((await send(postDailyLimit, admin, { limit: 20 })).status).toBe(INTERNAL_ERROR_STATUS);
      expect(await readDailyLookupLimit(database)).toBe(50);
    });

    it("rolls back a new invite", async () => {
      expect((await send(postInvite, admin, { email: "new@example.test" })).status).toBe(INTERNAL_ERROR_STATUS);
      expect(await database.select().from(invite)).toEqual([]);
    });

    it("rolls back a revoke", async () => {
      await database.execute(sql`alter table admin_audit_entry drop constraint ${sql.identifier(BLOCK_AUDIT)}`);
      const issued = issuedInviteSchema.parse(await (await send(postInvite, admin, { email: "new@example.test" })).json());
      await database.execute(sql`alter table admin_audit_entry add constraint ${sql.identifier(BLOCK_AUDIT)} check (false) not valid`);

      expect((await send(postRevoke, admin, { inviteId: issued.invite.id })).status).toBe(INTERNAL_ERROR_STATUS);
      const [row] = await database.select().from(invite).where(eq(invite.id, issued.invite.id));
      expect(row?.revokedAt).toBeNull();
    });

    it("rolls back new Village keys", async () => {
      await database.insert(memberNetwork).values({ userId: admin.userId });
      village.state.linkedMembers.set(await readExternalId(admin.userId), { status: "ready", email: admin.email });

      expect((await send(postVillageKeys, admin, FAKE_VILLAGE_KEYS)).status).toBe(INTERNAL_ERROR_STATUS);
      expect(await database.select().from(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageSecretKey))).toEqual([]);
    });

    it("rolls back branding", async () => {
      expect((await send(postBranding, admin, { name: "Northwind", descriptor: "", accentColor: "#0f7f86" })).status).toBe(INTERNAL_ERROR_STATUS);
      expect(await database.select().from(communityBranding)).toEqual([]);
    });

    it("rolls back a logo", async () => {
      expect((await postLogo(logoRequest(admin.cookie))).status).toBe(INTERNAL_ERROR_STATUS);
      expect(await database.select().from(communityBranding)).toEqual([]);
    });
  });

  describe("the logo", () => {
    it("audits saving and removing it", async () => {
      expect((await postLogo(logoRequest(admin.cookie))).status).toBe(OK_STATUS);
      expect((await deleteLogoRoute(jsonRequest(admin.cookie, {}))).status).toBe(OK_STATUS);

      expect((await readAuditActions()).sort()).toEqual([AUDIT_ACTIONS.logoRemoved, AUDIT_ACTIONS.logoSaved].sort());
    });
  });

  describe("an admin who lost the role mid-request", () => {
    let staleAdmin: Member;

    function staleContext() {
      return createRequestContext(getDatabase(), process.env, { id: staleAdmin.userId, email: staleAdmin.email, role: MEMBER_ROLES.admin });
    }

    beforeEach(async () => {
      staleAdmin = await createSignedInMember(database, "admin");
    });

    it.each([
      ["set the daily limit", () => setDailyLookupLimit(staleContext(), 200)],
      ["create an invite", () => createInvite(staleContext(), "new@example.test")],
      ["confirm an email", () => confirmMemberEmail(staleContext(), "anyone")],
    ])("can't %s after being removed", async (_label, act) => {
      await send(postRemove, admin, { memberId: staleAdmin.userId, contentChoice: CONTENT_CHOICES.keep });

      await expect(act()).rejects.toMatchObject({ status: FORBIDDEN_STATUS });
      expect(await readDailyLookupLimit(database)).toBe(50);
      expect(await database.select().from(invite)).toEqual([]);
      expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.memberRemoved]);
    });

    it("can't revoke an invite after being demoted", async () => {
      const issued = issuedInviteSchema.parse(await (await send(postInvite, admin, { email: "new@example.test" })).json());
      await database.update(user).set({ role: MEMBER_ROLES.member }).where(eq(user.id, staleAdmin.userId));

      await expect(revokeInvite(staleContext(), issued.invite.id)).rejects.toMatchObject({ status: FORBIDDEN_STATUS });
      const [row] = await database.select().from(invite).where(eq(invite.id, issued.invite.id));
      expect(row?.revokedAt).toBeNull();
    });

    it("never lands an action after their removal commits, racing every round", async () => {
      for (let round = 0; round < RACE_ROUNDS; round += 1) {
        await database.update(user).set({ role: MEMBER_ROLES.admin, banned: false }).where(eq(user.id, staleAdmin.userId));
        await database.delete(memberRemoval);
        await database.delete(adminAuditEntry);
        await Promise.allSettled([
          send(postRemove, admin, { memberId: staleAdmin.userId, contentChoice: CONTENT_CHOICES.keep }),
          setDailyLookupLimit(staleContext(), 100 + round),
        ]);

        const entries = await database.select().from(adminAuditEntry).orderBy(adminAuditEntry.createdAt);
        const removedAt = entries.find(({ action }) => action === AUDIT_ACTIONS.memberRemoved)?.createdAt;
        const limitAt = entries.find(({ action }) => action === AUDIT_ACTIONS.dailyLimitChanged)?.createdAt;
        if (limitAt && removedAt) expect(limitAt.getTime()).toBeLessThanOrEqual(removedAt.getTime());
      }
    });
  });

  describe("leaving the Village group on removal", () => {
    beforeEach(setUpVillage);

    it("leaves as the member, using their own token, and says so plainly", async () => {
      const externalId = await joinAndLink(member);

      const response = await remove(member);
      const { message, isGroupLeaveIncomplete } = departureResponseSchema.parse(await response.json());

      expect(isGroupLeaveIncomplete).toBe(false);
      expect(village.state.leftMembers.has(externalId)).toBe(true);
      expect(village.readRequests(LEAVE_PATH)[0]?.headers.authorization).toContain(externalId);
      expect(message).toContain("We also took them out of the Village group");
      expect(message).toContain("can't unsee");
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.left);
      const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));
      expect(network?.groupJoinedAt).toBeNull();
      expect(await readAuditActions()).toContain(AUDIT_ACTIONS.villageGroupLeft);
    });

    it("calls Village only after the removal committed, so a refused removal leaves nobody", async () => {
      await joinAndLink(member);
      await database.update(user).set({ role: MEMBER_ROLES.member }).where(eq(user.id, admin.userId));
      const otherAdmin = await createSignedInMember(database, "admin");
      await database.update(user).set({ role: MEMBER_ROLES.admin }).where(eq(user.id, admin.userId));

      expect((await send(postRemove, otherAdmin, { memberId: otherAdmin.userId, contentChoice: CONTENT_CHOICES.keep })).status).toBe(CONFLICT_STATUS);
      expect(village.readRequests(LEAVE_PATH)).toEqual([]);
    });

    it("still removes them when Village fails, and tells the admin", async () => {
      await joinAndLink(member);
      village.state.failures.set(LEAVE_PATH, { status: 500, type: "internal_error" });

      const response = await remove(member);
      const { message, isGroupLeaveIncomplete } = departureResponseSchema.parse(await response.json());

      expect(response.status).toBe(OK_STATUS);
      expect(isGroupLeaveIncomplete).toBe(true);
      const [row] = await database.select().from(user).where(eq(user.id, member.userId));
      expect(row?.banned).toBe(true);
      expect(message).toContain("We couldn't take Mo Member out of the Village group");
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.failed);
      const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));
      expect(network?.groupJoinedAt).not.toBeNull();
    });

    it("still removes them when Village can't be reached at all", async () => {
      await joinAndLink(member);
      process.env.VILLAGE_API_URL = "http://127.0.0.1:9";

      const response = await remove(member);
      process.env.VILLAGE_API_URL = village.url;

      expect(response.status).toBe(OK_STATUS);
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.failed);
    });

    it("tells the admin when Village refuses the group's creator", async () => {
      const externalId = await joinAndLink(member);
      village.state.groupCreatorIds.add(externalId);

      const { message } = acknowledgedResponseSchema.parse(await (await remove(member)).json());

      expect(message).toContain("Village refused");
      expect(message).toContain("they created it");
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.creatorRefused);
    });

    it("doesn't touch a Village account with someone else's email", async () => {
      const externalId = await joinAndLink(member);
      village.state.linkedMembers.set(externalId, { status: "ready", email: "someone-else@example.test" });

      await remove(member);

      expect(village.readRequests(LEAVE_PATH)).toEqual([]);
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.failed);
    });

    it("makes no Village call for someone never in the group", async () => {
      const { message } = acknowledgedResponseSchema.parse(await (await remove(member)).json());

      expect(village.readRequests(LEAVE_PATH)).toEqual([]);
      expect(message).not.toContain("Village");
    });

    it("lets an admin try again, and reports what happened", async () => {
      await joinAndLink(member);
      village.state.failures.set(LEAVE_PATH, { status: 500, type: "internal_error" });
      await remove(member);
      village.state.failures.clear();

      const { message } = acknowledgedResponseSchema.parse(await (await send(postLeaveGroup, admin, { memberId: member.userId })).json());

      expect(message).toContain("We also took them out");
      expect(await readRemovalOutcome(member.userId)).toBe(GROUP_DEPARTURE_OUTCOMES.left);
    });

    it("refuses a retry for someone not removed", async () => {
      expect((await send(postLeaveGroup, admin, { memberId: member.userId })).status).toBe(CONFLICT_STATUS);
    });

    it("forgets the group once its last member leaves, as a member's own leave does", async () => {
      await joinAndLink(member);

      await remove(member);

      expect(await readVillageGroup(database)).toBeNull();
    });

    describe("after a link reset", () => {
      let oldExternalId: string;

      beforeEach(async () => {
        oldExternalId = await joinAndLink(member);
        await joinMemberToGroup(database, admin.userId, "ada");
        await send(postLinkReset, admin, { memberId: member.userId, confirmed: true });
      });

      async function readRow() {
        const { members } = memberPageSchema.parse(await (await send(postMemberList, admin, {})).json());
        return members.find(({ id }) => id === member.userId);
      }

      it("keeps saying the old account is still in the group", async () => {
        expect(await readRow()).toMatchObject({ isInVillageGroup: false, hasStaleVillageMembership: true });
      });

      it("leaves with the old account on removal, using the ID from before the reset", async () => {
        const { message } = acknowledgedResponseSchema.parse(await (await remove(member)).json());

        expect(village.state.leftMembers.has(oldExternalId)).toBe(true);
        expect(message).toContain("We also took them out");
        expect(await readRow()).toMatchObject({ hasStaleVillageMembership: false, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.left });
      });

      it("stays stale, and says so, when that leave fails", async () => {
        village.state.failures.set(LEAVE_PATH, { status: 500, type: "internal_error" });

        await remove(member);

        expect(await readRow()).toMatchObject({ hasStaleVillageMembership: true, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.failed });
      });
    });

    describe("Wrong person?", () => {
      it("leaves with the claimant's account before its link data is gone", async () => {
        const issued = issuedInviteSchema.parse(await (await send(postInvite, admin, { email: member.email.replace("@", "+x@") })).json());
        await database.update(invite).set({ acceptedAt: new Date(), acceptedUserId: member.userId }).where(eq(invite.id, issued.invite.id));
        const externalId = await joinAndLink(member);
        village.state.linkedMembers.set(externalId, { status: "ready", email: issued.invite.email });

        const response = await send(postReclaim, admin, { inviteId: issued.invite.id });
        const replacement = issuedInviteSchema.parse(await response.json());

        expect(village.state.leftMembers.has(externalId)).toBe(true);
        expect(replacement.message).toContain("We also took them out");
      });
    });
  });

  describe("what removal does to cached results", () => {
    it("purges their cached paths", async () => {
      await database.insert(memberPathResult).values({ userId: member.userId, linkedinSlug: "someone", paths: null, fetchedAt: new Date() });

      await remove(member);

      expect(await database.select().from(memberPathResult).where(eq(memberPathResult.userId, member.userId))).toEqual([]);
    });

    it("stops counting a removed member as a Community member in someone's paths", async () => {
      await setUpVillage();
      const viewer = await createSignedInMember(database);
      await joinAndLink(viewer, "viewer");
      const targetId = await joinAndLink(member, "mo-target");
      village.state.pathsByUrl.set("https://www.linkedin.com/in/mo-target", { summary: "A path", paths: [] });
      village.state.failures.set(LEAVE_PATH, { status: 500, type: "internal_error" });
      expect(targetId).toBeTruthy();

      await remove(member);
      const paths = networkPathsSchema.parse(await (await send(postPaths, viewer, { linkedinSlug: "mo-target" })).json());

      expect(paths.isTargetMember).toBe(false);
    });
  });

  describe("counting searches and path lookups", () => {
    const TODAY = new Date().toISOString().slice(0, 10);

    it("records a search as a search", async () => {
      await setUpVillage();
      await joinAndLink(member);

      await send(postSearch, member, { prompt: "founders" });

      const [usage] = await database.select().from(memberDailyUsage).where(eq(memberDailyUsage.userId, member.userId));
      expect(usage).toMatchObject({ callCount: 1, searchCount: 1 });
    });

    it("records a path lookup as a path lookup", async () => {
      await setUpVillage();
      await joinAndLink(member);

      await send(postPaths, member, { linkedinSlug: "not-found-anywhere" });

      const [usage] = await database.select().from(memberDailyUsage).where(eq(memberDailyUsage.userId, member.userId));
      expect(usage?.searchCount).toBe(0);
    });

    it("splits usage per day and per member, and counts older rows as paths", async () => {
      await database.insert(memberDailyUsage).values({ userId: member.userId, usageDate: TODAY, callCount: 5, searchCount: 2 });

      const usage = await readCreditUsage(database);

      expect(usage).toMatchObject({ totalLookups: 5, totalSearches: 2, totalPathLookups: 3 });
      expect(usage.days[0]).toMatchObject({ searches: 2, pathLookups: 3 });
      expect(usage.members[0]).toMatchObject({ searches: 2, pathLookups: 3 });
    });

    it("estimates a search far above a path lookup, and labels it an estimate", () => {
      expect(estimateCreditCost({ searches: 1, pathLookups: 0 }).credits).toBeGreaterThanOrEqual(10);
      expect(estimateCreditCost({ searches: 0, pathLookups: 1 }).credits).toBe(5);
      expect(describeCreditEstimate({ searches: 1, pathLookups: 1 })).toBe("Estimate: about 16 credits, or $0.32");
    });
  });

  describe("reporting something again", () => {
    let reporter: Member;

    beforeEach(async () => {
      reporter = await createSignedInMember(database);
    });

    async function reportPost(postId: string) {
      const response = await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });
      return acknowledgedResponseSchema.parse(await response.json()).message;
    }

    async function dismissFirstOpen() {
      const { reports } = reportPageSchema.parse(await (await send(postReportList, admin, {})).json());
      await send(postReportDismiss, admin, { reportId: reports[0]?.id, targetType: reports[0]?.targetType });
    }

    it("says it's waiting when the report is still open", async () => {
      const postId = await seedPost(database, { authorId: member.userId });
      await reportPost(postId);

      expect(await reportPost(postId)).toBe(REPORT_SAVED_MESSAGES.alreadyOpen);
    });

    it("says truthfully it was reviewed, and queues nothing, after a dismissal", async () => {
      const postId = await seedPost(database, { authorId: member.userId });
      await reportPost(postId);
      await dismissFirstOpen();

      expect(await reportPost(postId)).toBe(REPORT_SAVED_MESSAGES.alreadyReviewed);
      const open = await database.select().from(contentReport);
      expect(open[0]?.resolvedAt).not.toBeNull();
    });

    it("reopens with the new words when the post changed after the dismissal", async () => {
      const postId = await seedPost(database, { authorId: member.userId, body: "Fine words" });
      await reportPost(postId);
      await dismissFirstOpen();
      await database.update(post).set({ body: "Rude words" }).where(eq(post.id, postId));

      expect(await reportPost(postId)).toBe(REPORT_SAVED_MESSAGES.saved);
      const { reports } = reportPageSchema.parse(await (await send(postReportList, admin, {})).json());
      expect(reports[0]?.body).toBe("Rude words");
    });

    it("says truthfully a dismissed message report was already reviewed", async () => {
      const conversationId = await seedConversation(database, member.userId, reporter.userId);
      await seedMessages(database, { conversationId, senderId: member.userId, count: 1 });
      const [message] = await database.select({ id: directMessage.id }).from(directMessage).where(eq(directMessage.conversationId, conversationId));
      await send(postMessageReport, reporter, { messageId: message?.id });
      await dismissFirstOpen();

      const again = await send(postMessageReport, reporter, { messageId: message?.id });

      expect(acknowledgedResponseSchema.parse(await again.json()).message).toContain("already reviewed");
      const reports = await database.select().from(messageReport);
      expect(reports).toHaveLength(1);
      expect(reports[0]?.resolvedAt).not.toBeNull();
    });
  });

  describe("inviting someone back as a new account", () => {
    async function acceptLink(link: string) {
      const token = readInviteToken(link);
      const response = await postAccept(jsonRequest(null, { token, name: "Mo Again", password: PASSWORD }));
      return { response, cookie: response.headers.getSetCookie()[0]?.split(";")[0] ?? "" };
    }

    it("refuses someone who wasn't removed", async () => {
      expect((await send(postReinvite, admin, { memberId: member.userId })).status).toBe(CONFLICT_STATUS);
    });

    it("refuses a member calling it", async () => {
      const other = await createSignedInMember(database);
      expect((await send(postReinvite, other, { memberId: member.userId })).status).toBe(FORBIDDEN_STATUS);
    });

    it("makes a new account with the same email, which can't read the old messages", async () => {
      const friend = await createSignedInMember(database);
      const conversationId = await seedConversation(database, member.userId, friend.userId);
      await seedMessages(database, { conversationId, senderId: member.userId, count: 1 });
      await remove(member);

      const issued = issuedInviteSchema.parse(await (await send(postReinvite, admin, { memberId: member.userId })).json());
      const { response, cookie } = await acceptLink(issued.link);

      expect(issued.invite.email).toBe(member.email);
      expect(response.status).toBe(CREATED_STATUS);
      const accounts = await database.select().from(user).where(eq(user.email, member.email));
      expect(accounts[0]?.id).not.toBe(member.userId);
      expect((await postThread(jsonRequest(cookie, { conversationId }))).status).toBe(404);
      expect(await database.select().from(conversation).where(eq(conversation.id, conversationId))).toHaveLength(1);
      expect(await readAuditActions()).toContain(AUDIT_ACTIONS.memberReinvited);
    });

    it("keeps the old account signed out for good", async () => {
      await remove(member);
      await send(postReinvite, admin, { memberId: member.userId });

      expect(await database.select().from(session).where(eq(session.userId, member.userId))).toEqual([]);
      const [old] = await database.select().from(user).where(eq(user.id, member.userId));
      expect(old?.email).toContain("reclaimed");
      expect((await reinviteRemovedMember(createRequestContext(getDatabase(), process.env, { id: admin.userId, email: admin.email, role: MEMBER_ROLES.admin }), member.userId).catch((error: { status: number }) => error.status))).toBe(CONFLICT_STATUS);
    });
  });
});
