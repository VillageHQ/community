import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

// PROF-04: a member's filled-in face from an outside host is in the page itself, not only after it loads in a browser.
describe("the avatar", () => {
  it("puts the filled-in face in the page, over the initials", () => {
    const html = renderToStaticMarkup(createElement(Avatar, { stableId: "m1", name: "Ada Example", imageUrl: "https://images.example.com/ada-example.jpg" }));

    expect(html).toContain('<img src="https://images.example.com/ada-example.jpg" alt=""');
    expect(html).toContain(">AE<");
  });

  it("shows only the initials without a face", () => {
    const html = renderToStaticMarkup(createElement(Avatar, { stableId: "m1", name: "Ada Example" }));

    expect(html).not.toContain("<img");
    expect(html).toContain(">AE<");
  });
});
