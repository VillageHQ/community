// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import {
  AUDIT_KINDS,
  CONTENT_CHOICES,
  REPORT_FILTERS,
  REPORT_TARGETS,
  type AdminMember,
  type AuditEntry,
  type Report,
} from "@/modules/admin/contract";
import { GROUP_DEPARTURE_OUTCOMES, VILLAGE_STATUSES } from "@/modules/network/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { API_ROUTES } from "@/platform/http/routes";
import { EnabledModulesProvider } from "@/platform/modules/enabled-modules";

import { AuditLog } from "./audit-log";
import { auditPageQuery } from "@/modules/admin/queries-audit";
import { FlashProvider, FlashSlot } from "@/components/flash";
import { MemberManage } from "./member-manage";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { reportPageQuery } from "@/modules/admin/queries-reports";
import { ReportQueue } from "./report-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => "/admin/members/mo" }));

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
    isErased: false,
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

    it("explains what happens to their asks only while asks is on", () => {
      const renderWithModules = (ids: string[]) =>
        render(
          wrap(
            createQueryClient(),
            createElement(
              EnabledModulesProvider,
              { ids },
              createElement(RemoveMemberDialog, {
                member: { id: "mo", name: "Mo Member", isAdmin: false, isInVillageGroup: false },
                trigger: createElement("button", { type: "button" }, "Open"),
                onDone: vi.fn(),
              }),
            ),
          ),
        );

      renderWithModules([]);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      expect(screen.queryByText(/Their asks leave the board/)).toBeNull();
      cleanup();

      renderWithModules([asksManifest.id]);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      expect(screen.getByText(/Their asks leave the board/)).toBeTruthy();
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

  describe("a member's Manage page", () => {
    // Each member's tools sit on their own page now (Founderhall's Members table opens it); a result flashes at the top.
    function renderMembers(members: AdminMember[]) {
      const queryClient = createQueryClient();
      render(
        wrap(
          queryClient,
          createElement(FlashProvider, null, createElement(FlashSlot), ...members.map((member) => createElement(MemberManage, { key: member.id, member, viewerId: VIEWER_ID }))),
        ),
      );
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

      expect(screen.getByRole("button", { name: "Make admin" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove member" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Unban" })).toBeNull();
    });

    it("holds promotion back until the email is confirmed", () => {
      renderMembers([makeMember({ isEmailConfirmed: false })]);

      expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();
      expect(screen.getByRole("button", { name: "Confirm their email" })).toBeTruthy();
    });

    it("offers an admin only the role they have to give up", () => {
      renderMembers([makeMember({ isAdmin: true })]);

      expect(screen.getByRole("button", { name: "Remove admin role" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();
    });

    it("offers you no way to change or remove yourself", () => {
      renderMembers([makeMember({ id: VIEWER_ID, isAdmin: true })]);

      expect(screen.queryByRole("button", { name: "Remove admin role" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Remove member" })).toBeNull();
      expect(screen.getByText(/You can't change your own role/)).toBeTruthy();
    });

    it("offers a removed member only Unban, and warns about a joined one", () => {
      renderMembers([makeMember({ isRemoved: true, isInVillageGroup: true, hasVillageLink: true, villageStatus: VILLAGE_STATUSES.ready })]);

      expect(screen.getByRole("button", { name: "Unban" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Remove member" })).toBeNull();
      expect(screen.getByText(/Mo is still in the Village group/)).toBeTruthy();
    });

    it("treats a stale membership after a link reset as still in the group", () => {
      renderMembers([makeMember({ hasVillageLink: true, hasStaleVillageMembership: true })]);

      expect(screen.getByText(/left their old Village account in the group/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
      expect(within(screen.getByRole("dialog")).getByText("We'll also take them out of the Village group")).toBeTruthy();
    });

    it("says Village refused for a group creator, and offers a retry", () => {
      renderMembers([makeMember({ isRemoved: true, isInVillageGroup: true, hasVillageLink: true, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.creatorRefused })]);

      expect(screen.getByText(/Village refused to take them out, because they created it/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try leaving the Village group again" })).toBeTruthy();
    });

    it("says they left, and offers no retry, after a successful leave", () => {
      renderMembers([makeMember({ isRemoved: true, villageLeaveOutcome: GROUP_DEPARTURE_OUTCOMES.left })]);

      expect(screen.getByText(/Village took Mo out of the group/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try leaving the Village group again" })).toBeNull();
    });

    it("offers to invite a removed member back as a new account, spelling out what's lost", () => {
      renderMembers([makeMember({ isRemoved: true })]);

      fireEvent.click(screen.getByRole("button", { name: "Invite them back as a new account" }));

      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText(/old account can't come back/)).toBeTruthy();
      expect(dialog.getByText(/Their old private messages stay on the old account/)).toBeTruthy();
    });

    it("doesn't show a failed group leave as a success", async () => {
      renderMembers([makeMember({ isInVillageGroup: true, hasVillageLink: true })]);
      vi.stubGlobal("fetch", respondWith({ message: "We couldn't take Mo out.", isGroupLeaveIncomplete: true }));

      fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove Mo" }));

      const notice = await screen.findByText("We couldn't take Mo out.");
      expect(notice.closest("[data-slot=flash]")?.className).toContain("fh-needs");
    });

    it("offers no reset link, ever", () => {
      renderMembers([makeMember({ isRemoved: true }), makeMember({ id: "bea", name: "Bea Bystander" })]);

      expect(screen.queryByRole("button", { name: /password/i })).toBeNull();
    });

    it("doesn't offer Unban for a reclaimed account", () => {
      renderMembers([makeMember({ isRemoved: true, isReclaimed: true, email: null })]);

      expect(screen.queryByRole("button", { name: "Unban" })).toBeNull();
    });

    it("shows the two emails before approving a Village account", () => {
      renderMembers([makeMember({ hasVillageLink: true, pendingVillageEmail: "other@example.test", villageStatus: VILLAGE_STATUSES.blocked })]);

      fireEvent.click(screen.getByRole("button", { name: "Approve this Village account" }));

      expect(within(screen.getByRole("dialog")).getByText("other@example.test")).toBeTruthy();
    });

    it("confirms before making an admin, and only then calls the server", async () => {
      renderMembers([makeMember()]);

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

    describe("on an ask", () => {
      function renderAskReport(enabledIds: string[]) {
        const queryClient = createQueryClient();
        queryClient.setQueryData(reportPageQuery(REPORT_FILTERS.open, 1).queryKey, {
          reports: [makeReport({ targetType: REPORT_TARGETS.ask })],
          page: 1,
          pageCount: 1,
          counts: { open: 1, resolved: 0 },
        });
        render(wrap(queryClient, createElement(EnabledModulesProvider, { ids: enabledIds }, createElement(ReportQueue, { viewerId: VIEWER_ID }))));
      }

      it("offers removing the ask, and says its offers go too", () => {
        renderAskReport([asksManifest.id]);

        fireEvent.click(screen.getByRole("button", { name: "Remove this ask" }));

        expect(within(screen.getByRole("dialog")).getByText(/along with its offers/)).toBeTruthy();
      });

      it("stays resolvable and says Asks is off when an admin turned it off", () => {
        renderAskReport([]);

        expect(screen.getByText("Asks is off")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Remove this ask" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
      });
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

    function readRow() {
      return document.querySelector("[data-audit-row]")?.textContent ?? "";
    }

    it("says the action in words, what it was done to, who did it and when", () => {
      renderLog([makeEntry({})]);

      expect(readRow()).toContain("Made an admin · Mo Member");
      expect(readRow()).toContain("Ada Admin");
      expect(readRow()).toContain("5 Nov 12:00 UTC");
    });

    it("says a Settings save in words", () => {
      renderLog([makeEntry({ action: AUDIT_ACTIONS.settingsSaved, targetName: null, detail: "name, accent" })]);

      expect(readRow()).toContain("Changed settings: community name, brand colour");
    });

    it("shows an existing deletion record with its reply count and text", () => {
      renderLog([makeEntry({ kind: AUDIT_KINDS.postDeleted, action: null, removedText: "Old words", removedReplyCount: 2 })]);

      expect(readRow()).toContain("Deleted a post and its 2 replies · Mo Member");
      expect(screen.getByText("Old words")).toBeTruthy();
    });
  });
});
