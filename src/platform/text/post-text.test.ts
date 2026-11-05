import { describe, expect, it } from "vitest";

import { collapseSegments, splitAnnouncement, splitIntoSegments, TEXT_SEGMENTS } from "./post-text";

function readLinks(text: string) {
  return splitIntoSegments(text).flatMap((segment) => (segment.kind === TEXT_SEGMENTS.link ? [segment] : []));
}

function joinSegments(text: string) {
  return splitIntoSegments(text)
    .map((segment) => segment.text)
    .join("");
}

describe("link detection", () => {
  it("finds http and https links", () => {
    const links = readLinks("See https://example.com/a?b=1#c and http://example.org.");

    expect(links.map(({ href }) => href)).toEqual(["https://example.com/a?b=1#c", "http://example.org/"]);
  });

  it("keeps every character of the original text", () => {
    const text = "Read (https://example.com/a), then https://example.org. Thanks!\nNext line";

    expect(joinSegments(text)).toBe(text);
  });

  it("leaves plain text alone", () => {
    expect(splitIntoSegments("No links here")).toEqual([{ kind: TEXT_SEGMENTS.text, text: "No links here" }]);
  });

  it("returns nothing for nothing", () => {
    expect(splitIntoSegments("")).toEqual([]);
  });

  it("matches the scheme in any case", () => {
    expect(readLinks("HTTPS://EXAMPLE.COM")[0]?.href).toBe("https://example.com/");
  });

  describe("trailing punctuation", () => {
    it.each([
      ["a full stop", "https://example.com.", "https://example.com/"],
      ["a comma", "https://example.com,", "https://example.com/"],
      ["an exclamation mark", "https://example.com!", "https://example.com/"],
      ["a closing bracket around the link", "(https://example.com/a)", "https://example.com/a"],
      ["a bracket and a full stop", "(https://example.com/a).", "https://example.com/a"],
    ])("leaves out %s", (_name, text, href) => {
      expect(readLinks(text)[0]?.href).toBe(href);
    });

    it("keeps a bracket that belongs to the link", () => {
      expect(readLinks("https://en.wikipedia.org/wiki/Bee_(disambiguation)")[0]?.href).toBe(
        "https://en.wikipedia.org/wiki/Bee_(disambiguation)",
      );
    });
  });

  describe("unsafe text", () => {
    it.each([
      ["javascript:", "javascript:alert(1)"],
      ["JavaScript: in mixed case", "JaVaScRiPt:alert(1)"],
      ["javascript: with slashes", "javascript://example.com/%0aalert(1)"],
      ["data:", "data:text/html,<script>alert(1)</script>"],
      ["vbscript:", "vbscript:msgbox(1)"],
      ["file:", "file:///etc/passwd"],
      ["ftp:", "ftp://example.com"],
      ["mailto:", "mailto:a@example.com"],
      ["a bare domain", "example.com"],
      ["a scheme with no host", "https://"],
      ["a scheme glued to a word", "xhttps://example.com"],
      ["credentials in the link", "https://google.com@evil.test"],
      ["a username and password", "https://user:secret@example.com"],
    ])("makes no link from %s", (_name, text) => {
      expect(readLinks(text)).toEqual([]);
    });

    it("keeps a link's href to http or https when hidden inside another scheme", () => {
      expect(readLinks("javascript:https://example.com")).toEqual([]);
    });

    it("stops a link at an angle bracket, so markup can't ride along", () => {
      const links = readLinks(`https://example.com/<script>alert(1)</script>`);

      expect(links[0]?.href).toBe("https://example.com/");
    });

    it("stops a link at a quote, so it can't break out of an attribute", () => {
      expect(readLinks(`https://example.com/"onmouseover="alert(1)`)[0]?.href).toBe("https://example.com/");
    });

    it.each([
      ["a right-to-left override", "\u202E"],
      ["a left-to-right embedding", "\u202A"],
      ["a directional isolate", "\u2067"],
      ["a right-to-left mark", "\u200F"],
    ])("drops %s, so a link's label can't lie", (_name, control) => {
      const segments = splitIntoSegments(`${control}moc.elgoog//:sptth https://evil.test/${control}moc.elgoog`);

      expect(segments.map(({ text }) => text).join("")).not.toContain(control);
      expect(readLinks(`https://evil.test/${control}moc.elgoog`)[0]?.text).toBe("https://evil.test/moc.elgoog");
    });

    it("keeps markup as plain text", () => {
      const text = `<img src=x onerror=alert(1)>`;

      expect(splitIntoSegments(text)).toEqual([{ kind: TEXT_SEGMENTS.text, text }]);
    });
  });
});

describe("link length", () => {
  const ROUND_BRACKETS = ")".repeat(1500);

  it("trims a long run of closing brackets", () => {
    expect(readLinks(`https://a.com/${ROUND_BRACKETS}`)[0]?.href).toBe("https://a.com/");
  });

  it("handles a full post of brackets without slowing down", () => {
    const body = `https://a.com/${")".repeat(1990)}`;
    const startedAt = performance.now();

    for (let post = 0; post < 200; post += 1) splitIntoSegments(body);

    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  it("keeps a link over the cap as text", () => {
    const text = `https://example.com/${"a".repeat(2048)}`;

    expect(readLinks(text)).toEqual([]);
    expect(joinSegments(text)).toBe(text);
  });
});

describe("collapsing long text", () => {
  function collapse(text: string) {
    return collapseSegments(splitIntoSegments(text));
  }

  function joinCollapsed(text: string) {
    return collapse(text)
      .segments.map((segment) => segment.text)
      .join("");
  }

  it("leaves short text whole", () => {
    expect(collapse("A short post.\nTwo lines.")).toMatchObject({ isCollapsed: false });
    expect(joinCollapsed("A short post.\nTwo lines.")).toBe("A short post.\nTwo lines.");
  });

  it("collapses after a few lines, however short", () => {
    const shown = joinCollapsed("line\n".repeat(1500));

    expect(collapse("line\n".repeat(1500)).isCollapsed).toBe(true);
    expect(shown.split("\n").length).toBeLessThanOrEqual(9);
  });

  it("collapses long text at a word boundary", () => {
    const shown = joinCollapsed("word ".repeat(600));

    expect(collapse("word ".repeat(600)).isCollapsed).toBe(true);
    expect(shown.length).toBeLessThan(620);
    expect(shown.endsWith("word…")).toBe(true);
  });

  it("collapses one unbroken word", () => {
    expect(collapse("a".repeat(3000)).isCollapsed).toBe(true);
    expect(joinCollapsed("a".repeat(3000)).length).toBeLessThan(620);
  });

  it("collapses text that follows a link once the lines run out", () => {
    const shown = joinCollapsed(`${"line\n".repeat(8)}https://example.com tail`);

    expect(collapse(`${"line\n".repeat(8)}https://example.com tail`).isCollapsed).toBe(true);
    expect(shown).not.toContain("tail");
    expect(shown.startsWith("line\n")).toBe(true);
  });

  it("never cuts a link in half", () => {
    const link = `https://example.com/${"a".repeat(200)}`;
    const { segments } = collapse(`${"word ".repeat(100)}${link} more`);

    const links = segments.flatMap((segment) => (segment.kind === TEXT_SEGMENTS.link ? [segment.text] : []));
    expect(links.every((text) => text === link)).toBe(true);
  });

  it("keeps a long link that opens the post", () => {
    const link = `https://example.com/${"a".repeat(1500)}`;

    expect(collapse(`${link} ${"word ".repeat(100)}`).segments[0]).toMatchObject({ kind: TEXT_SEGMENTS.link, text: link });
  });
});

describe("announcement splitting", () => {
  it("uses a short first line as the heading", () => {
    expect(splitAnnouncement("Dinner moves to Thursday\nSame place, 7pm.")).toEqual({
      heading: "Dinner moves to Thursday",
      body: "Same place, 7pm.",
    });
  });

  it("leaves a single line as the body", () => {
    expect(splitAnnouncement("Dinner moves to Thursday")).toEqual({ heading: null, body: "Dinner moves to Thursday" });
  });

  it("leaves a long first line as the body", () => {
    const body = `${"word ".repeat(40)}\nSecond line`;

    expect(splitAnnouncement(body).heading).toBeNull();
  });

  it("drops bidirectional controls from the heading", () => {
    expect(splitAnnouncement("\u202EDinner\nDetails").heading).toBe("Dinner");
  });

  it("skips the blank line after the heading", () => {
    expect(splitAnnouncement("Title\n\nBody").body).toBe("Body");
  });
});
