import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { postRequest, RequestFailure } from "./post-request";

const CUT_OFF_MESSAGE = "This search was cut off.";

describe("postRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the given message when the platform cuts a request off with HTML", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>Gateway Timeout</html>", { status: 504 }));

    await expect(postRequest("/path", {}, z.unknown(), CUT_OFF_MESSAGE)).rejects.toThrow(
      CUT_OFF_MESSAGE,
    );
  });

  it("keeps the status, so a caller can tell a dead session from a blip", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ message: "Sign in to continue." }, { status: 401 }));

    const failure = await postRequest("/path", {}, z.unknown()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RequestFailure);
    expect(failure).toMatchObject({ status: 401, message: "Sign in to continue." });
  });

  it("prefers the server's own friendly message", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ message: "Friendly." }, { status: 429 }));

    await expect(postRequest("/path", {}, z.unknown(), CUT_OFF_MESSAGE)).rejects.toThrow(
      "Friendly.",
    );
  });

  it("explains a connection that never completed", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await expect(postRequest("/path", {}, z.unknown())).rejects.toThrow("couldn't reach");
  });
});
