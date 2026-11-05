// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeatureScreen, type Feature } from "./feature-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const NETWORK: Feature = {
  id: "network",
  label: "Network",
  description: "Search each other's networks.",
  icon: null,
  needsVillage: true,
  turnOffNote: "Members stay in the Village group.",
  isOn: true,
  missingRequirement: null,
  dependentLabels: ["Intros"],
};

const INTROS: Feature = { ...NETWORK, id: "intros", label: "Intros", turnOffNote: null, dependentLabels: [] };

function renderScreen(features: Feature[]) {
  const element = createElement(FeatureScreen, { features, coreModules: [{ id: "members", label: "Members and invites", description: "", icon: null }] });
  render(createElement(QueryClientProvider, { client: new QueryClient() }, element));
}

describe("the features screen", () => {
  afterEach(cleanup);

  it("warns what turning off a requirement also does", () => {
    renderScreen([NETWORK, INTROS]);

    fireEvent.click(screen.getByRole("button", { name: "Turn off Network" }));

    expect(screen.getByText("This also pauses Intros, which needs Network.")).toBeTruthy();
    expect(screen.getByText("Members stay in the Village group.")).toBeTruthy();
  });

  it("offers to turn on what a paused feature needs", () => {
    renderScreen([{ ...INTROS, missingRequirement: { id: "network", label: "Network" } }]);

    expect(screen.getByText("Paused: needs Network")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn on Network" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn off Intros" })).toBeNull();
  });

  it("offers to turn on a feature that's off", () => {
    renderScreen([{ ...INTROS, isOn: false }]);

    expect(screen.getByRole("button", { name: "Turn on Intros" })).toBeTruthy();
  });

  it("shows core modules with no button", () => {
    renderScreen([]);

    expect(screen.getByText("Members and invites")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
