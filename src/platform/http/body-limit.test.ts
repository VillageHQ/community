import { describe, expect, it, vi } from "vitest";

import { withBodyLimit } from "./body-limit";

const MAXIMUM_BYTES = 8;
const URL = "http://localhost/route";
const HALF_DUPLEX = { duplex: "half" };

function createEchoRoute() {
  const handler = vi.fn(async (request: Request) => new Response(await request.text()));
  return { handler, route: withBodyLimit(MAXIMUM_BYTES, handler) };
}

function createPost(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request(URL, { method: "POST", headers, body, ...HALF_DUPLEX });
}

describe("withBodyLimit", () => {
  it("passes a body within the limit to the handler", async () => {
    const { route } = createEchoRoute();

    const response = await route(createPost("12345678"));

    expect(await response.text()).toBe("12345678");
  });

  it("passes requests without a body straight through", async () => {
    const { route, handler } = createEchoRoute();

    await route(new Request(URL));

    expect(handler).toHaveBeenCalledOnce();
  });

  it("refuses an oversized Content-Length before reading", async () => {
    const { route, handler } = createEchoRoute();
    const pull = vi.fn();

    const response = await route(
      createPost(new ReadableStream({ pull }), { "content-length": "9" }),
    );

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("stops reading a stream that passes the limit without Content-Length", async () => {
    const { route, handler } = createEchoRoute();
    const cancel = vi.fn();
    const stream = new ReadableStream({
      pull: (controller) => controller.enqueue(new Uint8Array(MAXIMUM_BYTES)),
      cancel,
    });

    const response = await route(createPost(stream));

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not trust a Content-Length that understates the stream", async () => {
    const { route } = createEchoRoute();
    const stream = new ReadableStream({
      pull: (controller) => controller.enqueue(new Uint8Array(MAXIMUM_BYTES)),
    });

    const response = await route(createPost(stream, { "content-length": "1" }));

    expect(response.status).toBe(413);
  });
});
