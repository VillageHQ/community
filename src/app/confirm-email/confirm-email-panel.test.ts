// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIRMATION_VIEWS } from "@/modules/members/contract-email-confirmation";

import { ConfirmEmailPanel } from "./confirm-email-panel";

const SHARED_PROPS = { token: "token", path: "/confirm-email", accountName: "Amara", accountEmail: "amara@example.test" };

function renderPanel(view: (typeof CONFIRMATION_VIEWS)[keyof typeof CONFIRMATION_VIEWS], isNetworkOn: boolean) {
  render(createElement(ConfirmEmailPanel, { ...SHARED_PROPS, view, isNetworkOn }));
}

describe("the confirm email page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Your email is confirmed." }), { headers: { "Content-Type": "application/json" } })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("doesn't send a member to Network with network off", () => {
    renderPanel(CONFIRMATION_VIEWS.invalid, false);

    expect(document.body.textContent).not.toMatch(/Network/);
  });

  it("names Network with network on", () => {
    renderPanel(CONFIRMATION_VIEWS.invalid, true);

    expect(document.body.textContent).toMatch(/Network/);
  });

  it("promises no network search after confirming with network off", async () => {
    renderPanel(CONFIRMATION_VIEWS.confirm, false);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Your email is confirmed")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Network search/);
  });
});
