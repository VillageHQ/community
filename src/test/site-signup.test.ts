// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

// The website (site/, its own folder, never deployed from here): its sign-up form names the managed plan that fits.
const SITE = resolve(import.meta.dirname, "../../site");

function typeMembers(count: string) {
  const field = document.getElementById("f-members") as HTMLInputElement;
  field.value = count;
  field.dispatchEvent(new Event("input"));
  return document.querySelector("[data-plan-price]")?.textContent;
}

describe("the website's sign-up form", () => {
  beforeAll(() => {
    const html = readFileSync(resolve(SITE, "index.html"), "utf8");
    document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
    // The page's own script, as the browser runs it.
    new Function(readFileSync(resolve(SITE, "assets/site.js"), "utf8"))();
  });

  it("offers Managed up to 500 members and Managed Growth up to 2,000", () => {
    expect(typeMembers("120")).toBe("From $1,000/mo");
    expect(typeMembers("1500")).toBe("From $2,500/mo (Managed Growth, up to 2,000 members)");
    expect(typeMembers("2000")).toBe("From $2,500/mo (Managed Growth, up to 2,000 members)");
  });

  it("offers a plan priced for the size above 2,000 members, never the 2,000-member plan", () => {
    const price = typeMembers("5000");
    expect(price).not.toContain("up to 2,000");
    expect(price).toBe("Priced for your size: above 2,000 members, Village quotes a plan with you");
  });
});
