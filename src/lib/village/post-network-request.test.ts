import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { postNetworkRequest } from "./post-network-request";

const CUT_OFF_MESSAGE = "This search was cut off.";

describe("postNetworkRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the given message when the platform cuts a request off with HTML", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>Gateway Timeout</html>", { status: 504 }));

    await expect(postNetworkRequest("/path", {}, z.unknown(), CUT_OFF_MESSAGE)).rejects.toThrow(
      CUT_OFF_MESSAGE,
    );
  });

  it("prefers the server's own friendly message", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ message: "Friendly." }, { status: 429 }));

    await expect(postNetworkRequest("/path", {}, z.unknown(), CUT_OFF_MESSAGE)).rejects.toThrow(
      "Friendly.",
    );
  });

  it("explains a connection that never completed", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await expect(postNetworkRequest("/path", {}, z.unknown())).rejects.toThrow("couldn't reach");
  });
});
