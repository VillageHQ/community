// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import {
  AUDIT_KINDS,
  CONTENT_CHOICES,
  GROUP_DEPARTURE_OUTCOMES,
  MEMBER_FILTERS,
  REPORT_FILTERS,
  REPORT_TARGETS,
  VILLAGE_STATUSES,
  type AdminMember,
  type AuditEntry,
  type MemberPage,
  type Report,
} from "@/lib/admin/admin-api";
import { API_ROUTES } from "@/platform/http/routes";

import { AuditLog } from "./audit-log/audit-log";
import { auditPageQuery } from "./audit-log/audit-queries";
import { memberPageQuery } from "./members/member-queries";
import { MemberManager } from "./members/member-manager";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { reportPageQuery } from "./reports/report-queries";
import { ReportQueue } from "./reports/report-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const TIMESTAMP = "2026-11-05T12:00:00.000Z";
const VIEWER_ID = "viewer";
const SERVER_ERROR_STATUS = 500;
const REPORT_ID = "11111111-1111-4111-8111-111111111111";

function makeMember(overrides: Partial<AdminMember> = {}): AdminMember {
  return {
    id: "mo",
    name: "Mo Member",
    email: "mo@example.test",
    avatarUrl: null,
    isAdmin: false,
    joinedAt: TIMESTAMP,
    isEmailConfirmed: true,
    isRemoved: false,
    isReclaimed: false,
    removedAt: null,
    removalContentChoice: null,
    inviteId: null,
    villageStatus: VILLAGE_STATUSES.notShared,
    hasVillageLink: false,
    pendingVillageEmail: null,
    isInVillageGroup: false,
    hasStaleVillageMembership: false,
    villageLeaveOutcome: null,
    linkedinUrl: null,
    isLinkedinConfirmed: false,
    ...overrides,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: REPORT_ID,
    targetType: REPORT_TARGETS.post,
    body: "The reported words",
    contentCreatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    reporterName: "Remy Reporter",
    reportedMemberName: "Mo Member",
    reportedMember: { id: "mo", name: "Mo Member", isAdmin: false, isRemoved: false, isInVillageGroup: true },
    isContentGone: false,
    resolution: null,
    resolvedAt: null,
    resolvedByName: null,
    ...overrides,
  };
}

function wrap(queryClient: QueryClient, children: ReactNode) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
}

function respondWith(body: unknown, status = 200) {
  return vi.fn(async () => Response.json(body, { status }));
}

function readRequestBody(fetchMock: ReturnType<typeof vi.fn>, path: string) {
  const call = fetchMock.mock.calls.find(([url]) => url === path);
  return JSON.parse(String(call?.[1]?.body));
}

describe("the admin screens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", respondWith({ message: "Done.", isGroupLeaveIncomplete: false }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("the remove dialog", () => {
    function renderDialog(isInVillageGroup: boolean) {
      const onDone = vi.fn();
      render(
        wrap(
          createQueryClient(),
          createElement(RemoveMemberDialog, {
            member: { id: "mo", name: "Mo Member", isAdmin: false, isInVillageGroup },
            trigger: createElement("button", { type: "button" }, "Open"),
            onDone,
          }),
        ),
      );
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      return { onDone, dialog: within(screen.getByRole("dialog")) };
    }

    it("says we try to take a joined member out of the group, what that can't undo, and what happens if it fails", () => {
      const { dialog } = renderDialog(true);

      expect(dialog.getByText("We'll also take them out of the Village group")).toBeTruthy();
      expect(dialog.getByText(/can't\s+unsee those/)).toBeTruthy();
      expect(dialog.getByText(/they're still removed here, their network stays shared/)).toBeTruthy();
    });

    it("hedges for someone this site doesn't think joined", () => {
      const { dialog } = renderDialog(false);

      expect(dialog.queryByText("We'll also take them out of the Village group")).toBeNull();
      expect(dialog.getByText(/As far as this site knows, Mo isn't in the Village group/)).toBeTruthy();
    });

    it("defaults to keeping content, and sends that choice", async () => {
      const { dialog, onDone } = renderDialog(false);

      expect(dialog.getByRole<HTMLInputElement>("radio", { name: /Keep their posts/ }).checked).toBe(true);
      fireEvent.click(dialog.getByRole("button", { name: "Remove Mo" }));

      await waitFor(() => expect(onDone).toHaveBeenCalledWith("Done.", false));
      expect(readRequestBody(vi.mocked(fetch), API_ROUTES.memberRemove)).toEqual({ memberId: "mo", contentChoice: CONTENT_CHOICES.keep });
    });

    it("sends the delete choice when chosen", async () => {
      const { dialog, onDone } = renderDialog(false);

      fireEvent.click(dialog.getByRole("radio", { name: /Delete their posts/ }));
      fireEvent.click(dialog.getByRole("button", { name: "Remove Mo" }));

      await waitFor(() => expect(onDone).toHaveBeenCalled());
      expect(readRequestBody(vi.mocked(fetch), API_ROUTES.memberRemove).contentChoice).toBe(CONTENT_CHOICES.delete);
    });

    it("stays open and shows why when the server refuses", async () => {
      vi.stubGlobal("fetch", respondWith({ message: "This community needs at least one admin." }, SERVER_ERROR_STATUS));
      const { dialog, onDone } = renderDialog(false);

      fireEvent.click(dialog.getByRole("button", { name: "Remove Mo" }));

      expect(await dialog.findByText("This community needs at least one admin.")).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
    });

    it("sends nothing on Cancel", () => {
      const { dialog } = renderDialog(false);

      fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("a member row", () => {
    function renderMembers(members: AdminMember[]) {
      const queryClient = createQueryClient();
      const page: MemberPage = {
        members,
        page: 1,
        pageCount: 1,
        matchCount: members.length,
        counts: { all: members.length, admins: 0, attention: 0, removed: 0 },
      };
      queryClient.setQueryData(memberPageQuery({ search: "", filter: MEMBER_FILTERS.all, page: 1 }).queryKey, page);
      render(wrap(queryClient, createElement(MemberManager, { viewerId: VIEWER_ID, initialSearch: "" })));
    }

    function openRow(name: string) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Manage\\s*${name}`) }));
    }

    it.each([
      [VILLAGE_STATUSES.notShared, "Village: Not shared"],
      [VILLAGE_STATUSES.sharing, "Village: Sharing"],
      [VILLAGE_STATUSES.syncing, "Village: Syncing"],
      [VILLAGE_STATUSES.ready, "Village: Ready"],
      [VILLAGE_STATUSES.blocked, "Village: Blocked for approval"],
    ])("shows %s in words", (villageStatus, label) => {
      renderMembers([makeMember({ villageStatus })]);

      expect(screen.getByText(label)).toBeTruthy();
    });

    it("offers a member promotion and removal", () => {
      renderMembers([makeMember()]);
      openRow("Mo Member");

      expect(screen.getByRole("button", { name: "Make admin" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove member" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Unban" })).toBeNull();
    });

    it("holds promotion back until the email is confirmed", () => {
      renderMembers([makeMember({ isEmailConfirmed: false })]);
      openRow("Mo Member");

      expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();
      expect(screen.getByRole("button", { name: "Confirm their email" })).toBeTruthy();
    });

    it("offers an admin only the role they have to give up", () => {
      renderMembers([makeMember({ isAdmin: true })]);
      openRow("Mo Member");

      expect(screen.getByRole("button", { name: "Remove admin role" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();
    });

    it("offers you no way to change or remove yourself", () => {
      renderMembers([makeMember({ id: VIEWER_ID, isAdmin: true })]);
      openRow("Mo Member");

      expect(screen.queryByRole("button", { name: "Remove admin role" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Remove member" })).toBeNull();
      expect(screen.getByText(/You can't change your own role/)).toBeTruthy();
    });

    it("offers a removed member only Unban, and warns about a joined one", () => {
      renderMembers([makeMember({ isRemoved: true, isInVillageGroup: true, hasVillageLink: true, villageStatus: VILLAGE_STATUSES.ready })]);
      openRow("Mo Member");

      expect(screen.getByRole("button", { name: "Unban" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Remove member" })).toBeNull();
      expect(screen.getByText(/Mo is still in the Village group/)).toBeTruthy();
    });

    it("treats a stale membership after a link reset as still in the group", () => {
      renderMembers([makeMember({ hasVillageLink: true, hasStaleVillageMembership: true })]);
      openRow("Mo Member");

      expect(screen.getByText(/left their old Village account in the group/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
      expect(within(screen.getByRole("dialog")).getByText("We'll also take them out of the Village group")).toBeTruthy();
    });

    it("says Village refused for a group creator, and offers a retry", () => {
      renderMembers([makeMember({ isRemoved: true, isInVillageGroup: true, hasVillageLink: true, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.creatorRefused })]);
      openRow("Mo Member");

      expect(screen.getByText(/Village refused to take them out, because they created it/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try leaving the Village group again" })).toBeTruthy();
    });

    it("says they left, and offers no retry, after a successful leave", () => {
      renderMembers([makeMember({ isRemoved: true, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.left })]);
      openRow("Mo Member");

      expect(screen.getByText(/Village took Mo out of the group/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try leaving the Village group again" })).toBeNull();
    });

    it("offers to invite a removed member back as a new account, spelling out what's lost", () => {
      renderMembers([makeMember({ isRemoved: true })]);
      openRow("Mo Member");

      fireEvent.click(screen.getByRole("button", { name: "Invite them back as a new account" }));

      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText(/old account can't come back/)).toBeTruthy();
      expect(dialog.getByText(/Their old private messages stay on the old account/)).toBeTruthy();
    });

    it("doesn't show a failed group leave as a success", async () => {
      renderMembers([makeMember({ isInVillageGroup: true, hasVillageLink: true })]);
      vi.stubGlobal("fetch", respondWith({ message: "We couldn't take Mo out.", isGroupLeaveIncomplete: true }));
      openRow("Mo Member");

      fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Mo" }));

      const notice = await screen.findByText("We couldn't take Mo out.");
      expect(notice.closest("[data-slot=alert]")?.className).not.toContain("sage");
    });

    it("offers no reset link, ever", () => {
      renderMembers([makeMember({ isRemoved: true }), makeMember({ id: "bea", name: "Bea Bystander" })]);
      openRow("Mo Member");
      openRow("Bea Bystander");

      expect(screen.queryByRole("button", { name: /password/i })).toBeNull();
    });

    it("doesn't offer Unban for a reclaimed account", () => {
      renderMembers([makeMember({ isRemoved: true, isReclaimed: true, email: null })]);
      openRow("Mo Member");

      expect(screen.queryByRole("button", { name: "Unban" })).toBeNull();
    });

    it("shows the two emails before approving a Village account", () => {
      renderMembers([makeMember({ hasVillageLink: true, pendingVillageEmail: "other@example.test", villageStatus: VILLAGE_STATUSES.blocked })]);
      openRow("Mo Member");

      fireEvent.click(screen.getByRole("button", { name: "Approve this Village account" }));

      expect(within(screen.getByRole("dialog")).getByText("other@example.test")).toBeTruthy();
    });

    it("confirms before making an admin, and only then calls the server", async () => {
      renderMembers([makeMember()]);
      openRow("Mo Member");

      fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
      expect(fetch).not.toHaveBeenCalled();
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, make them an admin" }));

      await waitFor(() => expect(readRequestBody(vi.mocked(fetch), API_ROUTES.memberRole)).toEqual({ memberId: "mo", role: "admin" }));
    });
  });

  describe("the report queue", () => {
    function renderQueue(reports: Report[], viewerId = VIEWER_ID) {
      const queryClient = createQueryClient();
      queryClient.setQueryData(reportPageQuery(REPORT_FILTERS.open, 1).queryKey, {
        reports,
        page: 1,
        pageCount: 1,
        counts: { open: reports.length, resolved: 0 },
      });
      render(wrap(queryClient, createElement(ReportQueue, { viewerId })));
    }

    it("names the reporter and shows the copy", () => {
      renderQueue([makeReport()]);

      expect(screen.getByText("Remy Reporter")).toBeTruthy();
      expect(screen.getByText("The reported words")).toBeTruthy();
    });

    it.each([
      [REPORT_TARGETS.post, "Delete this post"],
      [REPORT_TARGETS.comment, "Delete this reply"],
    ])("offers deleting a %s", (targetType, label) => {
      renderQueue([makeReport({ targetType })]);

      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    });

    it.each([REPORT_TARGETS.directMessage, REPORT_TARGETS.introNote])("says a %s can't be deleted, and offers no delete", (targetType) => {
      renderQueue([makeReport({ targetType })]);

      expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
      expect(screen.getByText(/can't delete/)).toBeTruthy();
    });

    it("hides delete once the author already deleted it", () => {
      renderQueue([makeReport({ isContentGone: true })]);

      expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
      expect(screen.getByText("Already deleted")).toBeTruthy();
    });

    it("hides Remove when the reported member is you", () => {
      renderQueue([makeReport()], "mo");

      expect(screen.queryByRole("button", { name: /Remove Mo/ })).toBeNull();
    });

    it("shows a friendly empty state", () => {
      renderQueue([]);

      expect(screen.getByRole("heading", { name: "Nothing to review" })).toBeTruthy();
    });
  });

  describe("the audit log", () => {
    function makeEntry(overrides: Partial<AuditEntry>): AuditEntry {
      return {
        id: "entry",
        kind: AUDIT_KINDS.action,
        action: AUDIT_ACTIONS.rolePromoted,
        actorId: "ada",
        actorName: "Ada Admin",
        targetName: "Mo Member",
        detail: null,
        removedText: null,
        removedReplyCount: 0,
        createdAt: TIMESTAMP,
        ...overrides,
      };
    }

    function renderLog(entries: AuditEntry[]) {
      const queryClient = createQueryClient();
      queryClient.setQueryData(auditPageQuery(1).queryKey, { entries, page: 1, pageCount: 1, entryCount: entries.length });
      render(wrap(queryClient, createElement(AuditLog)));
    }

    it("reads as a sentence with who, what and when", () => {
      renderLog([makeEntry({})]);

      const row = screen.getByRole("listitem");
      expect(row.textContent).toContain("Ada Admin made Mo Member an admin");
      expect(row.textContent).toContain("Nov 5, 2026, 12:00 PM UTC");
    });

    it("shows an existing deletion record with its reply count and text", () => {
      renderLog([makeEntry({ kind: AUDIT_KINDS.postDeleted, action: null, removedText: "Old words", removedReplyCount: 2 })]);

      expect(screen.getByRole("listitem").textContent).toContain("deleted a post by Mo Member and its 2 replies");
      expect(screen.getByText("Old words")).toBeTruthy();
    });
  });
});
