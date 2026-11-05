import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { adminAuditEntry } from "@/platform/audit/schema";
import { contentReport } from "@/database/admin-schema";
import { session, user } from "@/platform/database/auth-schema";
import { comment, moderationRecord, post, reaction } from "@/database/feed-schema";
import { introRequest } from "@/database/intro-schema";
import { invite, memberNetwork } from "@/modules/members/schema";
import { directMessage, messageReport } from "@/database/messages-schema";
import { memberDailyUsage } from "@/platform/village/schema";
import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import {
  AUDIT_KINDS,
  auditPageSchema,
  CONTENT_CHOICES,
  MEMBER_FILTERS,
  memberPageSchema,
  REPORT_FILTERS,
  REPORT_RESOLUTIONS,
  REPORT_TARGETS,
  reportPageSchema,
  VILLAGE_STATUSES,
} from "@/lib/admin/admin-api";
import { DAILY_LOOKUP_LIMITS } from "@/platform/village/contract";
import { MEMBER_ROLES } from "@/platform/auth/roles";
import { readCommunityHealth } from "@/lib/admin/community-health";
import { describeCreditEstimate, estimateCreditCost, readCreditUsage } from "@/lib/admin/credit-usage";
import { readOpenReportCount } from "@/lib/admin/reports";
import { feedPageSchema } from "@/lib/feed/feed-api";
import { INTRO_STATES } from "@/lib/intros/intro-api";
import { issuedInviteSchema } from "@/modules/members/contract-invites";
import { readMemberProfile } from "@/modules/members/service-profile";
import { readNavigationBadges } from "@/lib/navigation-badges";
import { readVillageStatus } from "@/lib/village/member-village-status";
import { readDailyLookupLimit, saveVillageKeys, readVillageOutOfCreditsAt } from "@/platform/village/settings";
import { saveVillageGroup } from "@/lib/village/settings";
import { NETWORK_ERROR_CODES, networkStatusSchema } from "@/lib/village/network-api";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { seedComment, seedPost } from "@/test/feed";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "@/test/fake-village-server";
import { joinMemberToGroup, nameMember } from "@/test/intros";
import { seedConversation, seedMessages } from "@/test/messages";
import { createSignedInMember } from "@/test/signed-in-member";

import { POST as postFeed } from "@/app/api/feed/route";
import { POST as postDeletePost } from "@/app/api/feed/posts/delete/route";
import { POST as postFeedReport } from "@/app/api/feed/report/route";
import { POST as postIntroDetail } from "@/app/api/intros/detail/route";
import { POST as postIntroReport } from "@/app/api/intros/report/route";
import { POST as postMessageReport } from "@/app/api/messages/report/route";
import { POST as postThread } from "@/app/api/messages/thread/route";
import { POST as postNetworkConsent } from "@/app/api/network/consent/route";
import { POST as postNetworkLinkedin } from "@/app/api/network/linkedin/route";
import { POST as postNetworkSearch } from "@/app/api/network/search/route";
import { POST as postNetworkStatus } from "@/app/api/network/status/route";
import { POST as postAuditLog } from "./audit-log/route";
import { POST as postBranding } from "./branding/route";
import { POST as postDailyLimit } from "./credits/limit/route";
import { POST as postInvite } from "./invites/route";
import { POST as postInviteList } from "./invites/list/route";
import { POST as postInviteReclaim } from "./invites/reclaim/route";
import { POST as postInviteResend } from "./invites/resend/route";
import { POST as postInviteRevoke } from "./invites/revoke/route";
import { POST as postClearLinkedin } from "./members/clear-linkedin/route";
import { POST as postConfirmLinkedin } from "./members/confirm-linkedin/route";
import { POST as postConfirm } from "./members/confirm/route";
import { POST as postMemberList } from "./members/list/route";
import { POST as postRemove } from "./members/remove/route";
import { POST as postRole } from "./members/role/route";
import { POST as postUnban } from "./members/unban/route";
import { POST as postWaiting } from "./members/waiting/route";
import { POST as postReportDelete } from "./reports/delete-content/route";
import { POST as postReportDismiss } from "./reports/dismiss/route";
import { POST as postReportList } from "./reports/list/route";
import { POST as postDomain } from "./setup/domain/route";
import { POST as postVillageGroup } from "./village/group/route";
import { POST as postVillageKeys } from "./village/keys/route";
import { POST as postVillageLinkReset } from "./village/links/reset/route";
import { POST as postVillageLinks } from "./village/links/route";

const APP_URL = "http://localhost:3000";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const BAD_GATEWAY_STATUS = 502;
const RACE_ROUNDS = 8;
const CONSENT_BODY = { acknowledged: true };
const RANDOM_UUID = "6f1f0d3e-8a57-4a39-9d0a-0f6c1c7b2a11";
const SECRET_NOTE = "A private note the admin must never see in full";
const REPORTED_DM = "This one message was reported";
const OTHER_DM = "This other message stays private";

const failureSchema = z.object({ code: z.string(), message: z.string() });

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Route = (request: Request) => Promise<Response>;

function jsonRequest(cookie: string | null, body: unknown, origin: string | null = APP_URL) {
  return new Request(`${APP_URL}/api/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("the admin tools", () => {
  const database = createTestDatabase();
  let admin: Member;
  let member: Member;

  function send(route: Route, actor: Member, body: unknown) {
    return route(jsonRequest(actor.cookie, body));
  }

  async function readUser(userId: string) {
    const [row] = await database.select().from(user).where(eq(user.id, userId));
    return row;
  }

  async function readActiveAdminIds() {
    const rows = await database
      .select({ id: user.id, banned: user.banned })
      .from(user)
      .where(eq(user.role, MEMBER_ROLES.admin));
    return rows.filter(({ banned }) => !banned).map(({ id }) => id);
  }

  async function readAuditActions() {
    const rows = await database.select({ action: adminAuditEntry.action }).from(adminAuditEntry);
    return rows.map(({ action }) => action);
  }

  async function listMembers(body: unknown = {}) {
    return memberPageSchema.parse(await (await send(postMemberList, admin, body)).json());
  }

  async function listReports(filter: string = REPORT_FILTERS.open) {
    return reportPageSchema.parse(await (await send(postReportList, admin, { filter })).json());
  }

  async function readAuditPage(page = 1) {
    return auditPageSchema.parse(await (await send(postAuditLog, admin, { page })).json());
  }

  beforeEach(async () => {
    await clearDatabase(database);
    admin = await createSignedInMember(database, "admin");
    member = await createSignedInMember(database);
    await nameMember(database, admin.userId, "Ada Admin");
    await nameMember(database, member.userId, "Mo Member");
  });

  describe("the member list", () => {
    it("shows admins each member's email, role, joined date and verification", async () => {
      const { members } = await listMembers();
      const row = members.find(({ id }) => id === member.userId);

      expect(row).toMatchObject({ name: "Mo Member", email: member.email, isAdmin: false, isEmailConfirmed: true, isRemoved: false });
      expect(row?.joinedAt).toEqual(expect.any(String));
    });

    it("finds a member by name or email, case-insensitively", async () => {
      expect((await listMembers({ search: "mo mem" })).members.map(({ id }) => id)).toEqual([member.userId]);
      expect((await listMembers({ search: admin.email.toUpperCase() })).members.map(({ id }) => id)).toEqual([admin.userId]);
    });

    it("treats wildcard characters as plain text", async () => {
      expect((await listMembers({ search: "%" })).members).toEqual([]);
    });

    it("pages at twelve", async () => {
      for (let position = 0; position < 12; position += 1) await createSignedInMember(database);

      const first = await listMembers({ page: 1 });
      const second = await listMembers({ page: 2 });

      expect(first.members).toHaveLength(12);
      expect(second.members).toHaveLength(2);
      expect(first.pageCount).toBe(2);
    });

    it("filters to admins, people needing attention, and removed members, and counts each", async () => {
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.userId));
      const removed = await createSignedInMember(database);
      await send(postRemove, admin, { memberId: removed.userId, contentChoice: CONTENT_CHOICES.keep });

      const page = await listMembers({ filter: MEMBER_FILTERS.attention });

      expect(page.members.map(({ id }) => id)).toEqual([member.userId]);
      expect(page.counts).toEqual({ all: 3, admins: 1, attention: 1, removed: 1 });
      expect((await listMembers({ filter: MEMBER_FILTERS.removed })).members.map(({ id }) => id)).toEqual([removed.userId]);
    });

    it("lists removed members last", async () => {
      await nameMember(database, member.userId, "Aaron First");
      await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

      expect((await listMembers()).members.at(-1)?.id).toBe(member.userId);
    });

    it("hides the invented email of a reclaimed account", async () => {
      await database.update(user).set({ email: `reclaimed-${member.userId}@reclaimed.invalid`, banned: true }).where(eq(user.id, member.userId));

      const row = (await listMembers()).members.find(({ id }) => id === member.userId);

      expect(row).toMatchObject({ email: null, isReclaimed: true, isRemoved: true });
    });
  });

  describe("the Village status", () => {
    const empty = { pendingVillageEmail: null, groupJoinedAt: null, villageLinkedAt: null, sharingConsentedAt: null };
    const now = new Date();

    it.each([
      ["not shared", empty, VILLAGE_STATUSES.notShared],
      ["sharing after consent", { ...empty, sharingConsentedAt: now }, VILLAGE_STATUSES.sharing],
      ["syncing once Village knows them", { ...empty, sharingConsentedAt: now, villageLinkedAt: now }, VILLAGE_STATUSES.syncing],
      ["ready in the group", { ...empty, sharingConsentedAt: now, villageLinkedAt: now, groupJoinedAt: now }, VILLAGE_STATUSES.ready],
      ["blocked over everything", { ...empty, groupJoinedAt: now, pendingVillageEmail: "other@example.test" }, VILLAGE_STATUSES.blocked],
    ])("reads %s", (_label, facts, status) => {
      expect(readVillageStatus(facts)).toBe(status);
    });

    describe("as members move through the network page", () => {
      let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

      beforeAll(async () => {
        village = await startFakeVillageServer();
        process.env.VILLAGE_API_URL = village.url;
      });

      afterAll(async () => {
        delete process.env.VILLAGE_API_URL;
        await village.stop();
      });

      beforeEach(() => {
        village.reset();
      });

      async function readStatus() {
        return (await listMembers()).members.find(({ id }) => id === member.userId)?.villageStatus;
      }

      async function externalId() {
        const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));
        return network?.villageExternalId ?? "";
      }

      async function setUpGroup() {
        await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
        await saveVillageGroup(database, { id: "group", inviteLink: "https://village.test/join/x" });
      }

      it("moves from not shared to sharing to syncing to ready, and shows the mismatch", async () => {
        await setUpGroup();
        expect(await readStatus()).toBe(VILLAGE_STATUSES.notShared);

        await send(postNetworkLinkedin, member, { linkedinUrl: "https://www.linkedin.com/in/mo" });
        await send(postNetworkConsent, member, CONSENT_BODY);
        expect(await readStatus()).toBe(VILLAGE_STATUSES.sharing);

        village.state.linkedMembers.set(await externalId(), { isSynced: false, email: member.email });
        networkStatusSchema.parse(await (await send(postNetworkStatus, member, {})).json());
        expect(await readStatus()).toBe(VILLAGE_STATUSES.syncing);

        village.state.linkedMembers.set(await externalId(), { isSynced: true, email: member.email });
        networkStatusSchema.parse(await (await send(postNetworkStatus, member, {})).json());
        expect(await readStatus()).toBe(VILLAGE_STATUSES.ready);

        village.state.linkedMembers.set(await externalId(), { isSynced: true, email: "someone-else@example.test" });
        await send(postNetworkStatus, member, {});
        expect(await readStatus()).toBe(VILLAGE_STATUSES.blocked);
      });
    });
  });

  describe("changing a role", () => {
    it("promotes a confirmed member and writes the audit entry", async () => {
      const response = await send(postRole, admin, { memberId: member.userId, role: MEMBER_ROLES.admin });

      expect(response.status).toBe(OK_STATUS);
      expect((await readUser(member.userId))?.role).toBe(MEMBER_ROLES.admin);
      expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.rolePromoted]);
    });

    it("demotes another admin and writes the audit entry", async () => {
      await database.update(user).set({ role: MEMBER_ROLES.admin }).where(eq(user.id, member.userId));

      const response = await send(postRole, admin, { memberId: member.userId, role: MEMBER_ROLES.member });

      expect(response.status).toBe(OK_STATUS);
      expect((await readUser(member.userId))?.role).toBe(MEMBER_ROLES.member);
      expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.roleDemoted]);
    });

    it("refuses promoting someone whose email isn't confirmed", async () => {
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.userId));

      const response = await send(postRole, admin, { memberId: member.userId, role: MEMBER_ROLES.admin });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect((await readUser(member.userId))?.role).toBe(MEMBER_ROLES.member);
    });

    it("refuses changing your own role", async () => {
      const response = await send(postRole, admin, { memberId: admin.userId, role: MEMBER_ROLES.member });

      expect(response.status).toBe(CONFLICT_STATUS);
      expect(await readActiveAdminIds()).toEqual([admin.userId]);
    });

    it("refuses promoting someone already removed", async () => {
      await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

      expect((await send(postRole, admin, { memberId: member.userId, role: MEMBER_ROLES.admin })).status).toBe(CONFLICT_STATUS);
    });

    it("answers 404 for an unknown member", async () => {
      expect((await send(postRole, admin, { memberId: "nobody", role: MEMBER_ROLES.admin })).status).toBe(NOT_FOUND_STATUS);
    });

    it("refuses a role the app doesn't know", async () => {
      expect((await send(postRole, admin, { memberId: member.userId, role: "owner" })).status).toBe(UNPROCESSABLE_STATUS);
    });
  });

  describe("two admins acting on each other at the same instant", () => {
    let otherAdmin: Member;

    beforeEach(async () => {
      otherAdmin = await createSignedInMember(database, "admin");
    });

    async function restoreBothAdmins() {
      await database.update(user).set({ role: MEMBER_ROLES.admin, banned: false, banReason: null });
      await database.update(user).set({ role: MEMBER_ROLES.member }).where(eq(user.id, member.userId));
    }

    async function signInAgainIfRemoved(actor: Member) {
      const sessions = await database.select().from(session).where(eq(session.userId, actor.userId));
      if (sessions.length > 0) return actor;
      const replacement = await createSignedInMember(database, "admin");
      await database.delete(user).where(eq(user.id, actor.userId));
      return replacement;
    }

    it("leaves exactly one admin after mutual demotion, every round", async () => {
      for (let round = 0; round < RACE_ROUNDS; round += 1) {
        const responses = await Promise.all([
          send(postRole, admin, { memberId: otherAdmin.userId, role: MEMBER_ROLES.member }),
          send(postRole, otherAdmin, { memberId: admin.userId, role: MEMBER_ROLES.member }),
        ]);

        expect(await readActiveAdminIds()).toHaveLength(1);
        expect(responses.map(({ status }) => status).sort()).toEqual([OK_STATUS, FORBIDDEN_STATUS]);
        await restoreBothAdmins();
      }
    });

    it("leaves exactly one admin after mutual removal, every round", async () => {
      for (let round = 0; round < RACE_ROUNDS; round += 1) {
        const responses = await Promise.all([
          send(postRemove, admin, { memberId: otherAdmin.userId, contentChoice: CONTENT_CHOICES.keep }),
          send(postRemove, otherAdmin, { memberId: admin.userId, contentChoice: CONTENT_CHOICES.keep }),
        ]);

        expect(await readActiveAdminIds()).toHaveLength(1);
        expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(1);
        await restoreBothAdmins();
        admin = await signInAgainIfRemoved(admin);
        otherAdmin = await signInAgainIfRemoved(otherAdmin);
      }
    });

    it("leaves exactly one admin when one demotes and the other removes", async () => {
      const responses = await Promise.all([
        send(postRole, admin, { memberId: otherAdmin.userId, role: MEMBER_ROLES.member }),
        send(postRemove, otherAdmin, { memberId: admin.userId, contentChoice: CONTENT_CHOICES.keep }),
      ]);

      expect(await readActiveAdminIds()).toHaveLength(1);
      expect(responses.filter(({ status }) => status === OK_STATUS)).toHaveLength(1);
    });

    it("keeps someone in charge when five admins all demote the next one", async () => {
      const extras = await Promise.all([1, 2, 3].map(() => createSignedInMember(database, "admin")));
      const ring = [admin, otherAdmin, ...extras];

      await Promise.all(
        ring.map((actor, position) =>
          send(postRole, actor, { memberId: ring[(position + 1) % ring.length]?.userId, role: MEMBER_ROLES.member }),
        ),
      );

      expect((await readActiveAdminIds()).length).toBeGreaterThanOrEqual(1);
    });

    it("refuses an admin who lost the role after their request started", async () => {
      await database.update(user).set({ role: MEMBER_ROLES.member }).where(eq(user.id, otherAdmin.userId));

      const response = await send(postRemove, otherAdmin, { memberId: admin.userId, contentChoice: CONTENT_CHOICES.keep });

      expect(response.status).toBe(FORBIDDEN_STATUS);
      expect(await readActiveAdminIds()).toEqual([admin.userId]);
    });

    it("writes only the change that landed to the audit log", async () => {
      await Promise.all([
        send(postRole, admin, { memberId: otherAdmin.userId, role: MEMBER_ROLES.member }),
        send(postRole, otherAdmin, { memberId: admin.userId, role: MEMBER_ROLES.member }),
      ]);

      expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.roleDemoted]);
    });

    it("never leaves a banned admin when Wrong person? races a promotion", async () => {
      const issued = await send(postInvite, admin, { email: "claimant@example.test" });
      const { invite: created } = issuedInviteSchema.parse(await issued.json());
      await database.insert(user).values({ id: "claimant", name: "Claimant", email: "claimant@example.test", emailVerified: true, role: MEMBER_ROLES.member });
      await database.update(invite).set({ acceptedAt: new Date(), acceptedUserId: "claimant" }).where(eq(invite.id, created.id));

      const responses = await Promise.all([
        send(postRole, otherAdmin, { memberId: "claimant", role: MEMBER_ROLES.admin }),
        send(postInviteReclaim, admin, { inviteId: created.id }),
      ]);
      const claimant = await readUser("claimant");

      expect(responses.some(({ status }) => status === OK_STATUS)).toBe(true);
      expect(claimant?.banned && claimant.role === MEMBER_ROLES.admin).toBe(false);
    });
  });

  describe("removing a member", () => {
    async function seedContent() {
      const postId = await seedPost(database, { authorId: member.userId, body: "Mo's post" });
      const replyByOther = await seedComment(database, { postId, authorId: admin.userId, body: "Ada replied" });
      const otherPost = await seedPost(database, { authorId: admin.userId, body: "Ada's post" });
      const replyByMo = await seedComment(database, { postId: otherPost, authorId: member.userId, body: "Mo replied" });
      await database.insert(reaction).values({ postId: otherPost, userId: member.userId, reaction: "heart" });
      return { postId, replyByOther, otherPost, replyByMo };
    }

    async function readFeedAs(viewer: Member) {
      return feedPageSchema.parse(await (await postFeed(jsonRequest(viewer.cookie, {}))).json());
    }

    it("ends their sessions and hides them from the directory", async () => {
      const response = await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

      expect(response.status).toBe(OK_STATUS);
      expect(await database.select().from(session).where(eq(session.userId, member.userId))).toEqual([]);
      expect((await readUser(member.userId))?.banned).toBe(true);
      expect(await readMemberProfile(database, member.userId)).toBeNull();
      expect((await postMemberList(jsonRequest(member.cookie, {}))).status).toBe(UNAUTHORIZED_STATUS);
    });

    it("requires an explicit choice about their content", async () => {
      const response = await send(postRemove, admin, { memberId: member.userId });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect((await readUser(member.userId))?.banned).toBe(false);
    });

    it("refuses removing yourself", async () => {
      await createSignedInMember(database, "admin");

      expect((await send(postRemove, admin, { memberId: admin.userId, contentChoice: CONTENT_CHOICES.keep })).status).toBe(CONFLICT_STATUS);
    });

    it("takes the admin role away, so an unban doesn't quietly restore it", async () => {
      await database.update(user).set({ role: MEMBER_ROLES.admin }).where(eq(user.id, member.userId));

      await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });
      await send(postUnban, admin, { memberId: member.userId });

      expect((await readUser(member.userId))?.role).toBe(MEMBER_ROLES.member);
    });

    describe("keeping their content", () => {
      it("leaves their posts and replies in the feed for other members", async () => {
        await seedContent();
        const reader = await createSignedInMember(database);

        await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });
        const feed = await readFeedAs(reader);

        expect(feed.posts.map(({ body }) => body)).toContain("Mo's post");
        expect(feed.posts.find(({ body }) => body === "Mo's post")?.author.isBanned).toBe(true);
        expect(feed.posts.flatMap(({ inlineComments }) => inlineComments).map(({ body }) => body)).toContain("Mo replied");
      });

      it("writes no deletion records", async () => {
        await seedContent();

        await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

        expect(await database.select().from(moderationRecord)).toEqual([]);
      });
    });

    describe("deleting their content", () => {
      it("removes their posts, replies and reactions, and copies each to the record", async () => {
        const { replyByOther, replyByMo, otherPost } = await seedContent();

        await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.delete });

        expect(await database.select().from(post).where(eq(post.authorId, member.userId))).toEqual([]);
        expect(await database.select().from(comment).where(eq(comment.authorId, member.userId))).toEqual([]);
        expect(await database.select().from(reaction).where(eq(reaction.postId, otherPost))).toEqual([]);
        const records = await database.select().from(moderationRecord);
        expect(records.map(({ targetId }) => targetId)).toEqual(expect.arrayContaining([replyByOther, replyByMo]));
        expect(records).toHaveLength(3);
        expect(records.find(({ targetType }) => targetType === "post")?.removedReplyCount).toBe(1);
      });

      it("leaves direct messages and intro asks alone", async () => {
        const conversationId = await seedConversation(database, admin.userId, member.userId);
        await seedMessages(database, { conversationId, senderId: member.userId, count: 1 });

        const response = await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.delete });

        expect(response.status).toBe(OK_STATUS);
        const page = await (await postThread(jsonRequest(admin.cookie, { conversationId }))).json();
        expect(JSON.stringify(page)).toContain("Seeded message 1");
      });
    });

    it("closes every open report against them", async () => {
      const postId = await seedPost(database, { authorId: member.userId });
      const reporter = await createSignedInMember(database);
      await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });

      await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

      expect(await readOpenReportCount(database)).toBe(0);
      expect((await listReports(REPORT_FILTERS.resolved)).reports[0]?.resolution).toBe(REPORT_RESOLUTIONS.memberRemoved);
    });
  });

  describe("unbanning", () => {
    it("lets them sign in again, restores kept content, and writes the audit entry", async () => {
      await send(postRemove, admin, { memberId: member.userId, contentChoice: CONTENT_CHOICES.keep });

      const response = await send(postUnban, admin, { memberId: member.userId });

      expect(response.status).toBe(OK_STATUS);
      expect((await readUser(member.userId))?.banned).toBe(false);
      expect(await readMemberProfile(database, member.userId)).not.toBeNull();
      expect(await readAuditActions()).toEqual(expect.arrayContaining([AUDIT_ACTIONS.memberRemoved, AUDIT_ACTIONS.memberUnbanned]));
    });

    it("answers 409 for someone not removed", async () => {
      expect((await send(postUnban, admin, { memberId: member.userId })).status).toBe(CONFLICT_STATUS);
    });

    it("refuses an account locked by Wrong person?", async () => {
      await database.update(user).set({ email: `reclaimed-${member.userId}@reclaimed.invalid`, banned: true }).where(eq(user.id, member.userId));

      expect((await send(postUnban, admin, { memberId: member.userId })).status).toBe(CONFLICT_STATUS);
    });
  });

  describe("reporting", () => {
    let reporter: Member;

    beforeEach(async () => {
      reporter = await createSignedInMember(database);
      await nameMember(database, reporter.userId, "Remy Reporter");
    });

    describe("a post", () => {
      it("saves a copy, and names the reporter to admins only", async () => {
        const postId = await seedPost(database, { authorId: member.userId, body: "Buy my course" });

        const response = await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });
        await database.update(post).set({ body: "Edited to look innocent" }).where(eq(post.id, postId));
        const { reports } = await listReports();

        expect(response.status).toBe(OK_STATUS);
        expect(reports[0]).toMatchObject({ body: "Buy my course", reporterName: "Remy Reporter", reportedMemberName: "Mo Member", isContentGone: false });
        expect(JSON.stringify(await response.clone().json())).not.toContain("Remy");
      });

      it("refuses your own post", async () => {
        const postId = await seedPost(database, { authorId: reporter.userId });

        expect((await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("answers 404 for a post that doesn't exist", async () => {
        expect((await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: RANDOM_UUID })).status).toBe(NOT_FOUND_STATUS);
      });

      it("answers 404 for a hidden post of a banned author", async () => {
        const postId = await seedPost(database, { authorId: member.userId });
        await database.update(user).set({ banned: true }).where(eq(user.id, member.userId));

        expect((await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId })).status).toBe(NOT_FOUND_STATUS);
      });

      it("keeps one report per person per post", async () => {
        const postId = await seedPost(database, { authorId: member.userId });

        await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });
        await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });

        expect(await readOpenReportCount(database)).toBe(1);
      });

      it("requires being signed in, and a trusted origin", async () => {
        const postId = await seedPost(database, { authorId: member.userId });
        const body = { targetType: REPORT_TARGETS.post, targetId: postId };

        expect((await postFeedReport(jsonRequest(null, body))).status).toBe(UNAUTHORIZED_STATUS);
        expect((await postFeedReport(jsonRequest(reporter.cookie, body, "https://evil.test"))).status).toBe(FORBIDDEN_STATUS);
      });
    });

    describe("a comment", () => {
      it("saves a copy for the queue", async () => {
        const postId = await seedPost(database, { authorId: admin.userId });
        const commentId = await seedComment(database, { postId, authorId: member.userId, body: "Rude reply" });

        await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.comment, targetId: commentId });

        expect((await listReports()).reports[0]).toMatchObject({ targetType: REPORT_TARGETS.comment, body: "Rude reply" });
      });

      it("answers 404 when its post is hidden", async () => {
        const hiddenAuthor = await createSignedInMember(database);
        const postId = await seedPost(database, { authorId: hiddenAuthor.userId });
        const commentId = await seedComment(database, { postId, authorId: member.userId });
        await database.update(user).set({ banned: true }).where(eq(user.id, hiddenAuthor.userId));

        expect((await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.comment, targetId: commentId })).status).toBe(NOT_FOUND_STATUS);
      });
    });

    describe("an intro note", () => {
      async function seedIntro(overrides: Partial<typeof introRequest.$inferInsert> = {}) {
        await joinMemberToGroup(database, member.userId, "mo");
        await joinMemberToGroup(database, reporter.userId, "remy");
        const [intro] = await database
          .insert(introRequest)
          .values({
            requesterId: member.userId,
            introducerId: reporter.userId,
            targetLinkedinSlug: "target",
            targetName: "Secret Target",
            introducerName: "Remy Reporter",
            introducerLinkedinSlug: "remy",
            reason: "Worked together",
            note: SECRET_NOTE,
            expiresAt: new Date(Date.now() + 86_400_000),
            ...overrides,
          })
          .returning({ id: introRequest.id });
        return intro?.id ?? "";
      }

      it("lets the introducer report the note, showing admins only the copy", async () => {
        const introId = await seedIntro();

        const response = await send(postIntroReport, reporter, { introId });
        const { reports } = await listReports();

        expect(response.status).toBe(OK_STATUS);
        expect(reports[0]).toMatchObject({ targetType: REPORT_TARGETS.introNote, body: SECRET_NOTE, reporterName: "Remy Reporter", reportedMemberName: "Mo Member" });
        expect(JSON.stringify(reports)).not.toContain("Secret Target");
      });

      it("refuses the requester reporting their own note", async () => {
        expect((await send(postIntroReport, member, { introId: await seedIntro() })).status).toBe(UNPROCESSABLE_STATUS);
      });

      it("answers anyone else, admins included, with the same 404 as a missing ask", async () => {
        const introId = await seedIntro();

        expect((await send(postIntroReport, admin, { introId })).status).toBe(NOT_FOUND_STATUS);
        expect((await send(postIntroReport, reporter, { introId: RANDOM_UUID })).status).toBe(NOT_FOUND_STATUS);
      });

      it("refuses a note that never reached the introducer", async () => {
        const introId = await seedIntro({ isWithheld: true });

        expect((await send(postIntroReport, reporter, { introId })).status).toBe(NOT_FOUND_STATUS);
      });

      it("keeps intros closed to admins, reported or not", async () => {
        const introId = await seedIntro();
        await send(postIntroReport, reporter, { introId });

        expect((await send(postIntroDetail, admin, { introId })).status).toBe(NOT_FOUND_STATUS);
      });
    });

    describe("a direct message", () => {
      async function seedReportedMessage() {
        const conversationId = await seedConversation(database, member.userId, reporter.userId);
        await seedMessages(database, { conversationId, senderId: member.userId, count: 2 });
        const [reported, other] = await database.select({ id: directMessage.id }).from(directMessage).where(eq(directMessage.conversationId, conversationId));
        if (!reported || !other) throw new Error("Expected two seeded messages.");
        await database.update(directMessage).set({ body: REPORTED_DM }).where(eq(directMessage.id, reported.id));
        await database.update(directMessage).set({ body: OTHER_DM }).where(eq(directMessage.id, other.id));
        await send(postMessageReport, reporter, { messageId: reported.id });
        return { conversationId, messageId: reported.id };
      }

      it("shows admins the reported copy and nothing else from the conversation", async () => {
        const { conversationId } = await seedReportedMessage();

        const queue = JSON.stringify(await listReports());
        const audit = JSON.stringify(await readAuditPage());

        expect(queue).toContain(REPORTED_DM);
        expect(queue).not.toContain(OTHER_DM);
        expect(queue).not.toContain(conversationId);
        expect(audit).not.toContain(OTHER_DM);
      });

      it("still answers an admin's thread request with a 404", async () => {
        const { conversationId } = await seedReportedMessage();

        expect((await postThread(jsonRequest(admin.cookie, { conversationId }))).status).toBe(NOT_FOUND_STATUS);
      });

      it("refuses deleting the message from the queue", async () => {
        await seedReportedMessage();
        const { reports } = await listReports();

        const response = await send(postReportDelete, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.directMessage });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
        expect(await readOpenReportCount(database)).toBe(1);
      });

      it("keeps the copy after the sender deletes the message", async () => {
        const { messageId } = await seedReportedMessage();
        await database.update(directMessage).set({ body: null, deletedAt: new Date() }).where(eq(directMessage.id, messageId));

        expect((await listReports()).reports[0]?.body).toBe(REPORTED_DM);
      });

      it("lets an admin dismiss it, with an audit entry that holds no message text", async () => {
        await seedReportedMessage();
        const { reports } = await listReports();

        const response = await send(postReportDismiss, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.directMessage });

        expect(response.status).toBe(OK_STATUS);
        expect(await readOpenReportCount(database)).toBe(0);
        expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.reportDismissed]);
        expect(JSON.stringify(await database.select().from(adminAuditEntry))).not.toContain(REPORTED_DM);
      });
    });

    describe("working through the queue", () => {
      async function reportPost(by: Member, postId: string) {
        await send(postFeedReport, by, { targetType: REPORT_TARGETS.post, targetId: postId });
      }

      it("deletes a reported post, closes every report on it, and records the copy", async () => {
        const postId = await seedPost(database, { authorId: member.userId, body: "Spam" });
        const secondReporter = await createSignedInMember(database);
        await reportPost(reporter, postId);
        await reportPost(secondReporter, postId);
        const { reports } = await listReports();

        const response = await send(postReportDelete, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.post });

        expect(response.status).toBe(OK_STATUS);
        expect(await database.select().from(post).where(eq(post.id, postId))).toEqual([]);
        expect(await readOpenReportCount(database)).toBe(0);
        expect((await database.select().from(moderationRecord))[0]?.targetBody).toBe("Spam");
        expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.reportedContentDeleted]);
      });

      it("deletes a reported comment", async () => {
        const postId = await seedPost(database, { authorId: admin.userId });
        const commentId = await seedComment(database, { postId, authorId: member.userId });
        await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.comment, targetId: commentId });
        const { reports } = await listReports();

        await send(postReportDelete, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.comment });

        expect(await database.select().from(comment).where(eq(comment.id, commentId))).toEqual([]);
      });

      it("flags content the author already deleted, and answers 409 to a delete", async () => {
        const postId = await seedPost(database, { authorId: member.userId });
        await reportPost(reporter, postId);
        await database.delete(post).where(eq(post.id, postId));
        const { reports } = await listReports();

        const response = await send(postReportDelete, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.post });

        expect(reports[0]?.isContentGone).toBe(true);
        expect(response.status).toBe(CONFLICT_STATUS);
      });

      it("refuses deleting an intro note from the queue", async () => {
        const [report] = await database
          .insert(contentReport)
          .values({ targetType: REPORT_TARGETS.introNote, targetId: RANDOM_UUID, body: "note", contentCreatedAt: new Date() })
          .returning({ id: contentReport.id });

        const response = await send(postReportDelete, admin, { reportId: report?.id, targetType: REPORT_TARGETS.introNote });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
      });

      it("answers 409 when two admins dismiss the same report", async () => {
        const postId = await seedPost(database, { authorId: member.userId });
        await reportPost(reporter, postId);
        const secondAdmin = await createSignedInMember(database, "admin");
        const { reports } = await listReports();
        const body = { reportId: reports[0]?.id, targetType: REPORT_TARGETS.post };

        const responses = await Promise.all([send(postReportDismiss, admin, body), send(postReportDismiss, secondAdmin, body)]);

        expect(responses.map(({ status }) => status).sort()).toEqual([OK_STATUS, CONFLICT_STATUS]);
        expect(await readAuditActions()).toEqual([AUDIT_ACTIONS.reportDismissed]);
      });

      it("adds open reports to the Admin badge, and drops them when handled", async () => {
        const postId = await seedPost(database, { authorId: member.userId });
        const before = (await readNavigationBadges(database, { APP_URL })).admin ?? 0;
        await reportPost(reporter, postId);

        expect((await readNavigationBadges(database, { APP_URL })).admin).toBe(before + 1);

        const { reports } = await listReports();
        await send(postReportDismiss, admin, { reportId: reports[0]?.id, targetType: REPORT_TARGETS.post });

        expect((await readNavigationBadges(database, { APP_URL })).admin).toBe(before);
      });

      it("pages open reports across every kind", async () => {
        for (let position = 0; position < 11; position += 1) {
          const postId = await seedPost(database, { authorId: member.userId, body: `Spam ${position}` });
          await reportPost(reporter, postId);
        }

        const { reports, pageCount, counts } = await listReports();

        expect(reports).toHaveLength(10);
        expect(pageCount).toBe(2);
        expect(counts).toEqual({ open: 11, resolved: 0 });
      });
    });
  });

  describe("the audit log", () => {
    it("shows who did what, including existing deletion records", async () => {
      const postId = await seedPost(database, { authorId: member.userId, body: "Removed words" });
      await seedComment(database, { postId, authorId: admin.userId });
      await send(postDeletePost, admin, { postId });
      await send(postRole, admin, { memberId: member.userId, role: MEMBER_ROLES.admin });

      const { entries, entryCount } = await readAuditPage();
      const promotion = entries.find(({ action }) => action === AUDIT_ACTIONS.rolePromoted);
      const deletion = entries.find(({ kind }) => kind === AUDIT_KINDS.postDeleted);

      expect(entryCount).toBe(3);
      expect(promotion).toMatchObject({ actorName: "Ada Admin", targetName: "Mo Member" });
      expect(deletion).toMatchObject({ actorName: "Ada Admin", targetName: "Mo Member", removedText: "Removed words", removedReplyCount: 1 });
    });

    it("orders newest first and pages at twenty", async () => {
      await database.insert(adminAuditEntry).values(
        Array.from({ length: 21 }, (_unused, position) => ({
          action: AUDIT_ACTIONS.inviteCreated,
          actorName: "Ada Admin",
          targetName: `person-${position}@example.test`,
          createdAt: new Date(Date.UTC(2026, 0, position + 1)),
        })),
      );

      const first = await readAuditPage(1);
      const second = await readAuditPage(2);

      expect(first.entries).toHaveLength(20);
      expect(first.entries[0]?.targetName).toBe("person-20@example.test");
      expect(second.entries).toHaveLength(1);
    });

    it("keeps the record after the actor leaves", async () => {
      const otherAdmin = await createSignedInMember(database, "admin");
      await nameMember(database, otherAdmin.userId, "Grace Gone");
      await send(postRole, otherAdmin, { memberId: member.userId, role: MEMBER_ROLES.admin });

      await database.delete(user).where(eq(user.id, otherAdmin.userId));

      expect((await readAuditPage()).entries[0]?.actorName).toBe("Grace Gone");
    });

    describe.each([
      ["confirming an email", AUDIT_ACTIONS.emailConfirmed, async () => {
        await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.userId));
        return send(postConfirm, admin, { memberId: member.userId });
      }],
      ["confirming a LinkedIn", AUDIT_ACTIONS.linkedinConfirmed, async () => {
        await joinMemberToGroup(database, member.userId, "mo");
        return send(postConfirmLinkedin, admin, { memberId: member.userId });
      }],
      ["clearing a LinkedIn", AUDIT_ACTIONS.linkedinCleared, async () => {
        await joinMemberToGroup(database, member.userId, "mo");
        return send(postClearLinkedin, admin, { linkedinUrl: "https://www.linkedin.com/in/mo" });
      }],
      ["approving a Village link", AUDIT_ACTIONS.villageLinkApproved, async () => {
        await database.insert(memberNetwork).values({ userId: member.userId, pendingVillageEmail: "other@example.test" });
        return send(postVillageLinks, admin, { memberId: member.userId, villageEmail: "other@example.test" });
      }],
      ["resetting a Village link", AUDIT_ACTIONS.villageLinkReset, async () => {
        await database.insert(memberNetwork).values({ userId: member.userId });
        return send(postVillageLinkReset, admin, { memberId: member.userId, confirmed: true });
      }],
      ["creating an invite", AUDIT_ACTIONS.inviteCreated, () => send(postInvite, admin, { email: "new@example.test" })],
      ["saving the daily limit", AUDIT_ACTIONS.dailyLimitChanged, () => send(postDailyLimit, admin, { limit: 20 })],
      ["confirming the domain", AUDIT_ACTIONS.domainConfirmed, () => send(postDomain, admin, { confirmed: true })],
    ])("after %s", (_label, action, perform) => {
      it("writes an entry", async () => {
        const response = await perform();

        expect(response.ok).toBe(true);
        expect(await readAuditActions()).toEqual([action]);
      });
    });
  });

  describe("community health", () => {
    it("counts only real members, posts, activity, intros and invites", async () => {
      const removed = await createSignedInMember(database);
      await send(postRemove, admin, { memberId: removed.userId, contentChoice: CONTENT_CHOICES.keep });
      await joinMemberToGroup(database, member.userId, "mo");
      await database.insert(memberNetwork).values({ userId: admin.userId, sharingConsentedAt: new Date() });
      const oldDate = new Date(Date.now() - 20 * 86_400_000);
      await seedPost(database, { authorId: member.userId });
      await seedPost(database, { authorId: admin.userId, createdAt: oldDate });
      await send(postInvite, admin, { email: "pending@example.test" });

      const health = await readCommunityHealth(database);

      expect(health).toMatchObject({ members: 2, sharing: 2, synced: 1 });
      expect(health.windows).toEqual([
        { days: 7, posts: 1, activeMembers: 1 },
        { days: 30, posts: 2, activeMembers: 2 },
      ]);
      expect(health.invites).toMatchObject({ accepted: 0, pending: 1, sent: 1, acceptedPercent: 0 });
      expect(health.intros.find(({ state }) => state === INTRO_STATES.requested)?.count).toBe(0);
    });

    it("shows no acceptance rate before any invite", async () => {
      expect((await readCommunityHealth(database)).invites.acceptedPercent).toBeNull();
    });

    it("counts a member who only sends messages as active, without reading them", async () => {
      const conversationId = await seedConversation(database, admin.userId, member.userId);
      await seedMessages(database, { conversationId, senderId: member.userId, count: 1 });

      const health = await readCommunityHealth(database);

      expect(health.windows[0]?.activeMembers).toBe(1);
      expect(JSON.stringify(health)).not.toContain("Seeded message");
    });
  });

  describe("credits", () => {
    const TODAY = new Date().toISOString().slice(0, 10);
    const LONG_AGO = "2020-01-01";

    async function seedUsage(userId: string, usageDate: string, callCount: number) {
      await database.insert(memberDailyUsage).values({ userId, usageDate, callCount });
    }

    it("sums lookups per day and per member within 30 days", async () => {
      await seedUsage(member.userId, TODAY, 3);
      await seedUsage(admin.userId, TODAY, 1);
      await seedUsage(admin.userId, LONG_AGO, 99);

      const usage = await readCreditUsage(database);

      expect(usage.totalLookups).toBe(4);
      expect(usage.days).toEqual([{ usageDate: TODAY, lookups: 4, searches: 0, pathLookups: 4 }]);
      expect(usage.members.map(({ name, lookups, lookupsToday }) => ({ name, lookups, lookupsToday }))).toEqual([
        { name: "Mo Member", lookups: 3, lookupsToday: 3 },
        { name: "Ada Admin", lookups: 1, lookupsToday: 1 },
      ]);
      expect(usage.spendingMemberCount).toBe(2);
    });

    it("estimates at Village's path price and $0.02 a credit", () => {
      expect(estimateCreditCost({ searches: 0, pathLookups: 10 })).toEqual({ credits: 50, dollars: 1 });
    });

    it("doesn't talk about zero credits when nothing was spent", () => {
      expect(describeCreditEstimate({ searches: 0, pathLookups: 0 })).toBe("Nothing spent yet");
    });

    describe("the daily limit", () => {
      it("defaults to fifty", async () => {
        expect(await readDailyLookupLimit(database)).toBe(DAILY_LOOKUP_LIMITS.default);
      });

      it("saves a limit inside the bounds", async () => {
        const response = await send(postDailyLimit, admin, { limit: DAILY_LOOKUP_LIMITS.maximum });

        expect(response.status).toBe(OK_STATUS);
        expect(await readDailyLookupLimit(database)).toBe(DAILY_LOOKUP_LIMITS.maximum);
      });

      it.each([0, -1, DAILY_LOOKUP_LIMITS.maximum + 1, 1.5, "20"])("refuses %s", async (limit) => {
        const response = await send(postDailyLimit, admin, { limit });

        expect(response.status).toBe(UNPROCESSABLE_STATUS);
        expect(await readDailyLookupLimit(database)).toBe(DAILY_LOOKUP_LIMITS.default);
      });
    });

    describe("against Village", () => {
      let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

      beforeAll(async () => {
        village = await startFakeVillageServer();
        process.env.VILLAGE_API_URL = village.url;
      });

      afterAll(async () => {
        delete process.env.VILLAGE_API_URL;
        await village.stop();
      });

      beforeEach(async () => {
        village.reset();
        await saveVillageKeys(database, FAKE_VILLAGE_KEYS);
        await saveVillageGroup(database, { id: "group", inviteLink: "https://village.test/join/x" });
        await joinMemberToGroup(database, member.userId, "mo");
        const [network] = await database.select().from(memberNetwork).where(eq(memberNetwork.userId, member.userId));
        village.state.linkedMembers.set(network?.villageExternalId ?? "", { isSynced: true, email: member.email });
      });

      function search() {
        return send(postNetworkSearch, member, { prompt: "founders" });
      }

      it("enforces a lowered limit on the next lookup, with the number in the message", async () => {
        await send(postDailyLimit, admin, { limit: 1 });
        await search();

        const response = await search();
        const body = failureSchema.parse(await response.json());

        expect(body.code).toBe(NETWORK_ERROR_CODES.dailyLimitReached);
        expect(body.message).toContain("limit of 1 ");
      });

      it("tells a member plainly when Village answers 402, shows it to admins, and clears it on success", async () => {
        village.state.failures.set("/v2/people/search", { status: 402, type: "insufficient_credits" });

        const response = await search();
        const body = failureSchema.parse(await response.json());

        expect(response.status).toBe(BAD_GATEWAY_STATUS);
        expect(body.code).toBe(NETWORK_ERROR_CODES.outOfCredits);
        expect(body.message).toContain("You don't need to do anything");
        expect(await readVillageOutOfCreditsAt(database)).not.toBeNull();
        const badgeWhileOut = (await readNavigationBadges(database, { APP_URL })).admin ?? 0;

        village.state.failures.clear();
        await search();

        expect(await readVillageOutOfCreditsAt(database)).toBeNull();
        expect((await readNavigationBadges(database, { APP_URL })).admin).toBe(badgeWhileOut - 1);
      });

      it("doesn't count a 402 against the member's lookups", async () => {
        village.state.failures.set("/v2/people/search", { status: 402, type: "insufficient_credits" });

        await search();

        const [usage] = await database.select().from(memberDailyUsage).where(and(eq(memberDailyUsage.userId, member.userId)));
        expect(usage?.callCount ?? 0).toBe(0);
      });
    });
  });

  describe("access control", () => {
    const REPORT_BODY = { reportId: RANDOM_UUID, targetType: REPORT_TARGETS.post };
    const ADMIN_ROUTES: [string, Route, () => unknown][] = [
      ["member list", postMemberList, () => ({})],
      ["role", postRole, () => ({ memberId: member.userId, role: MEMBER_ROLES.admin })],
      ["remove", postRemove, () => ({ memberId: admin.userId, contentChoice: CONTENT_CHOICES.delete })],
      ["unban", postUnban, () => ({ memberId: member.userId })],
      ["waiting", postWaiting, () => ({})],
      ["confirm email", postConfirm, () => ({ memberId: member.userId })],
      ["confirm LinkedIn", postConfirmLinkedin, () => ({ memberId: member.userId })],
      ["clear LinkedIn", postClearLinkedin, () => ({ linkedinUrl: "https://www.linkedin.com/in/mo" })],
      ["approve link", postVillageLinks, () => ({ memberId: member.userId, villageEmail: "a@b.test" })],
      ["reset link", postVillageLinkReset, () => ({ memberId: member.userId, confirmed: true })],
      ["keys", postVillageKeys, () => FAKE_VILLAGE_KEYS],
      ["group", postVillageGroup, () => ({ name: "G", acknowledged: true })],
      ["branding", postBranding, () => ({ name: "Hijacked", descriptor: "", accentColor: "#0f7f86" })],
      ["domain", postDomain, () => ({ confirmed: true })],
      ["invite", postInvite, () => ({ email: "x@y.test" })],
      ["invite list", postInviteList, () => ({})],
      ["invite resend", postInviteResend, () => ({ inviteId: RANDOM_UUID })],
      ["invite revoke", postInviteRevoke, () => ({ inviteId: RANDOM_UUID })],
      ["invite reclaim", postInviteReclaim, () => ({ inviteId: RANDOM_UUID })],
      ["report list", postReportList, () => ({})],
      ["report dismiss", postReportDismiss, () => REPORT_BODY],
      ["report delete", postReportDelete, () => REPORT_BODY],
      ["audit log", postAuditLog, () => ({})],
      ["daily limit", postDailyLimit, () => ({ limit: 500 })],
    ];

    describe.each(ADMIN_ROUTES)("%s", (_label, route, createBody) => {
      it("answers a member with 403 and changes nothing", async () => {
        const response = await route(jsonRequest(member.cookie, createBody()));

        expect(response.status).toBe(FORBIDDEN_STATUS);
        expect((await readUser(member.userId))?.role).toBe(MEMBER_ROLES.member);
        expect((await readUser(admin.userId))?.banned).toBe(false);
        expect(await database.select().from(adminAuditEntry)).toEqual([]);
      });

      it("answers a visitor with 401", async () => {
        expect((await route(jsonRequest(null, createBody()))).status).toBe(UNAUTHORIZED_STATUS);
      });

      it("refuses another site, even with an admin's cookie", async () => {
        expect((await route(jsonRequest(admin.cookie, createBody(), "https://evil.test"))).status).toBe(FORBIDDEN_STATUS);
      });

      it("refuses a missing Origin", async () => {
        expect((await route(jsonRequest(admin.cookie, createBody(), null))).status).toBe(FORBIDDEN_STATUS);
      });
    });

    it("doesn't reveal who reported to the reported member", async () => {
      const postId = await seedPost(database, { authorId: member.userId, body: "Mine" });
      const reporter = await createSignedInMember(database);
      await nameMember(database, reporter.userId, "Remy Reporter");
      await send(postFeedReport, reporter, { targetType: REPORT_TARGETS.post, targetId: postId });

      const feed = await (await postFeed(jsonRequest(member.cookie, {}))).text();

      expect(feed).not.toContain("Remy Reporter");
      expect(await database.select().from(contentReport).where(isNull(contentReport.resolvedAt))).toHaveLength(1);
    });

    it("lets no admin route return a message outside a report", async () => {
      const conversationId = await seedConversation(database, member.userId, admin.userId);
      await seedMessages(database, { conversationId, senderId: member.userId, count: 1 });

      const responses = await Promise.all([
        send(postReportList, admin, {}),
        send(postAuditLog, admin, {}),
        send(postMemberList, admin, {}),
      ]);
      const bodies = await Promise.all(responses.map((response) => response.text()));

      expect(bodies.join()).not.toContain("Seeded message");
      expect(await database.select().from(messageReport)).toEqual([]);
    });
  });
});
