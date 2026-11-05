// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunWithoutVillage } from "./run-without-village";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("running without Village", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Network is off." }), { headers: { "Content-Type": "application/json" } })));
    render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(RunWithoutVillage, { moduleId: "network" })));
    fireEvent.click(screen.getByRole("button", { name: "Run without Village" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Run without Village" }).at(-1) ?? document.body);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("confirms what happened", async () => {
    expect(await screen.findByRole("heading", { name: "You're running without Village" })).toBeTruthy();
  });

  it("refreshes the page once the admin closes the confirmation", async () => {
    await screen.findByRole("heading", { name: "You're running without Village" });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(refresh).toHaveBeenCalled();
  });
});
