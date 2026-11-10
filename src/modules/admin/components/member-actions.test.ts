// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { networkManifest } from "@/modules/network/manifest";
import { EnabledModulesProvider } from "@/platform/modules/enabled-modules";

import type { AdminMember } from "../contract";
import { MemberActions } from "./member-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const MEMBER: AdminMember = {
  id: "jonas",
  name: "Jonas Lindqvist",
  email: "jonas@example.test",
  avatarUrl: null,
  isAdmin: false,
  joinedAt: "2026-11-05T10:00:00.000Z",
  isEmailConfirmed: true,
  isRemoved: false,
  isReclaimed: false,
    isErased: false,
  removedAt: null,
  removalContentChoice: null,
  inviteId: null,
  villageStatus: "ready",
  hasVillageLink: true,
  pendingVillageEmail: "jonas@village.test",
  isInVillageGroup: true,
  hasStaleVillageMembership: false,
  villageLeaveOutcome: null,
  linkedinUrl: null,
  isLinkedinConfirmed: false,
};

function renderActions(member: AdminMember, enabledIds: string[]) {
  const actions = createElement(MemberActions, { member, viewerId: "admin", manageButtonRef: createRef<HTMLButtonElement>(), fallbackFocusId: "fallback", onDone: vi.fn() });
  render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(EnabledModulesProvider, { ids: enabledIds }, actions)));
}

describe("the member actions", () => {
  afterEach(cleanup);

  describe("with network off", () => {
    it("offers no Village action that would answer 404", () => {
      renderActions(MEMBER, []);

      expect(screen.queryByRole("button", { name: /Reset Village link/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Approve this Village account/ })).toBeNull();
    });

    it("keeps the departure retry for a removed member still in the group", () => {
      renderActions({ ...MEMBER, isRemoved: true }, []);

      expect(screen.getByRole("button", { name: /Try leaving the Village group again/ })).toBeTruthy();
    });
  });

  it("offers them with network on", () => {
    renderActions(MEMBER, [networkManifest.id]);

    expect(screen.getByRole("button", { name: /Reset Village link/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approve this Village account/ })).toBeTruthy();
  });
});
