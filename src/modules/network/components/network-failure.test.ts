// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NETWORK_ERROR_CODES } from "@/modules/network/contract";
import { RequestFailure } from "@/platform/http/post-request";

import { NetworkFailure } from "./network-failure";

const BAD_GATEWAY_STATUS = 502;

describe("a network failure", () => {
  afterEach(cleanup);

  it("tells a member plainly when the community is out of credits, without blaming them", () => {
    const failure = new RequestFailure(BAD_GATEWAY_STATUS, "Raw server words", NETWORK_ERROR_CODES.outOfCredits);

    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(NetworkFailure, { error: failure, resetErrorBoundary: vi.fn() }),
      ),
    );

    expect(screen.getByRole("heading", { name: "Lookups are paused for now" })).toBeTruthy();
    expect(screen.getByText(/you don't need to do anything/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
    expect(screen.queryByText("Raw server words")).toBeNull();
  });
});
