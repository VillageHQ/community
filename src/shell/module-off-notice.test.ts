// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REQUEST_ERROR_CODES } from "@/platform/http/error-codes";
import { postRequest, RequestFailure } from "@/platform/http/post-request";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { ROUTES } from "@/platform/http/routes";

import { ModuleOffNotice } from "./module-off-notice";

const NOT_FOUND_STATUS = 404;

function stubAnswer(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: NOT_FOUND_STATUS, headers: { "Content-Type": "application/json" } })));
}

async function failRequest() {
  await act(async () => {
    await expect(postRequest("/api/network/linkedin", {}, acknowledgedResponseSchema)).rejects.toBeInstanceOf(RequestFailure);
  });
}

describe("a request to a module that's off", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a stale tab a way home", async () => {
    stubAnswer({ code: REQUEST_ERROR_CODES.moduleOff, message: "An admin turned this off." });
    render(createElement(ModuleOffNotice));

    await failRequest();

    expect(screen.getByRole("alert").textContent).toContain("turned off");
    expect(screen.getByRole("link", { name: "Go home" }).getAttribute("href")).toBe(ROUTES.feed);
  });

  it("stays quiet for any other 404", async () => {
    stubAnswer({ code: "feed_not_found", message: "This post is gone." });
    render(createElement(ModuleOffNotice));

    await failRequest();

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
