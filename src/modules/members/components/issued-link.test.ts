import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INVITE_EMAIL_STATUSES, INVITE_STATES } from "@/modules/members/contract-invite-state";

import { IssuedLink } from "./issued-link";

const ISSUED = {
  link: "https://community.example/join/token",
  message: "New link ready. The old link no longer works.",
  invite: {
    id: "invite-1",
    email: "amara@example.test",
    state: INVITE_STATES.pending,
    emailStatus: INVITE_EMAIL_STATUSES.notSent,
    invitedByName: "Priya",
    acceptedUserId: null,
    createdAt: "2026-11-04T00:00:00.000Z",
    expiresAt: "2026-11-18T00:00:00.000Z",
    acceptedAt: null,
    revokedAt: null,
  },
};

describe("the issued link", () => {
  it("warns that the old link stopped working", () => {
    const markup = renderToStaticMarkup(createElement(IssuedLink, { issued: ISSUED }));

    expect(markup).toContain("The old link no longer works");
  });
});
