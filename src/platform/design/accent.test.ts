import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  DEFAULT_ACCENT_COLOR,
  DARK_SURFACES,
  deriveAccentTokens,
  deriveDarkFundColors,
  deriveFundColors,
  LEAF,
  NEUTRALS,
  parseAccentColor,
  renderAccentCss,
  type ThemeMode,
} from "./accent";

const CHANNEL_STEP = 51;
const MODES: ThemeMode[] = ["light", "dark"];
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

function sampleColors() {
  const colors: string[] = [];
  for (let red = 0; red <= 255; red += CHANNEL_STEP) {
    for (let green = 0; green <= 255; green += CHANNEL_STEP) {
      for (let blue = 0; blue <= 255; blue += CHANNEL_STEP) {
        const channels = [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0"));
        colors.push(`#${channels.join("")}`);
      }
    }
  }
  return colors;
}

function findContrastFailures(color: string, mode: ThemeMode) {
  const { canvas, surface, sunk } = NEUTRALS[mode];
  const { accent, onAccent, accentText, accentSoft, accentEdge } = deriveAccentTokens(color, mode);
  const pairs = [
    { text: accent, background: onAccent, minimum: AA_TEXT },
    ...[canvas, surface, sunk, accentSoft].map((background) => ({ text: accentText, background, minimum: AA_TEXT })),
    { text: accentEdge, background: surface, minimum: AA_NON_TEXT },
  ];
  return pairs
    .filter(({ text, background, minimum }) => contrastRatio(text, background) < minimum)
    .map(({ text, background }) => `${color} in ${mode}: ${text} on ${background}`);
}

describe("accent derivation", () => {
  it.each([
    ["#0f7f86", "light", { accent: "#0f7f86", onAccent: "#ffffff", accentText: "#087980", accentSoft: "#daf5f6" }],
    ["#0f7f86", "dark", { accent: "#0f7f86", onAccent: "#ffffff", accentText: "#49a8af", accentSoft: "#0f383b" }],
    ["#ffc93c", "light", { accent: "#ffc93c", onAccent: "#000000", accentText: "#876705", accentSoft: "#f7eeda" }],
    ["#14213d", "dark", { accent: "#59698b", onAccent: "#ffffff", accentText: "#8799bd", accentSoft: "#263149" }],
    ["#e8604c", "light", { accent: "#e8604c", onAccent: "#000000", accentText: "#c13c2a", accentSoft: "#fee9e5" }],
    ["#2556e8", "dark", { accent: "#295bed", onAccent: "#ffffff", accentText: "#6996ff", accentSoft: "#263149" }],
  ] as const)("matches the design table for %s in %s", (color, mode, expected) => {
    expect(deriveAccentTokens(color, mode)).toMatchObject(expected);
  });

  it("keeps a sweep of colors readable in both themes", () => {
    const failures = MODES.flatMap((mode) => sampleColors().flatMap((color) => findContrastFailures(color, mode)));

    expect(failures).toEqual([]);
  });
});

describe("accent validation", () => {
  it("accepts a six-digit hex and lowercases it", () => {
    expect(parseAccentColor("#ABCDEF")).toBe("#abcdef");
  });

  it.each([
    "#abc",
    "#abcdefg",
    "abcdef",
    "red",
    "",
    "#000000;}body{display:none}",
    "#000000\n;}",
    "url(https://evil.test/x)",
    "</style><script>alert(1)</script>",
    null,
    42,
  ])("refuses %j", (value) => {
    expect(parseAccentColor(value)).toBeNull();
  });
});

describe("the accent style sheet", () => {
  it("writes the stored accent as the light fill", () => {
    expect(renderAccentCss("#2556E8")).toContain("--primary:#2556e8");
    expect(renderAccentCss("#ffc93c")).toContain("--primary:#8e7021");
  });

  it("writes both themes", () => {
    const css = renderAccentCss(DEFAULT_ACCENT_COLOR);

    expect(css).toContain(":root{");
    expect(css).toContain(":root.dark{");
  });

  it.each([
    "#000000;}body{display:none}",
    "</style><script>alert(1)</script>",
    "#000;background:url(//evil.test)",
  ])("falls back to the default instead of writing %s", (hostile) => {
    expect(renderAccentCss(hostile)).toBe(renderAccentCss(DEFAULT_ACCENT_COLOR));
  });

  it("contains only variables and hex colors", () => {
    expect(renderAccentCss("#e8604c")).toMatch(/^(:root(\.dark)?\{(--[a-z-]+:#[0-9a-f]{6};?)+\})+$/);
  });
});

describe("the fund colour (Founderhall's rule)", () => {
  it.each([
    ["#24525A", { fund: "#24525a", deep: "#1b3e44", tint: "#dce3e5", isAdjusted: false }],
    ["#ffc93c", { fund: "#8e7021", deep: "#6b5419", tint: "#ede8db", isAdjusted: true }],
    ["#0f7f86", { fund: "#0f7f86", deep: "#0b5f65", tint: "#d9ebec", isAdjusted: false }],
    ["#e8604c", { fund: "#b54b3b", deep: "#88382c", tint: "#f3e2e0", isAdjusted: true }],
  ] as const)("gives Founderhall's values for %s", (color, expected) => {
    expect(deriveFundColors(color)).toEqual(expected);
  });

  it("reads at 4.5:1 on Leaf for every colour", () => {
    const failures = sampleColors().filter((color) => contrastRatio(deriveFundColors(color).fund, LEAF) < AA_TEXT);

    expect(failures).toEqual([]);
  });

  it("is written as --fund, --fund-deep and --fund-tint", () => {
    expect(renderAccentCss("#24525a")).toContain("--fund:#24525a;--fund-deep:#1b3e44;--fund-tint:#dce3e5");
  });
});

describe("the fund colour in dark mode", () => {
  it("lightens Founderhall's demo teal until it reads on the dark sheets", () => {
    const { fund, deep, tint } = deriveDarkFundColors("#24525A");

    expect({ fund, deep, tint }).toEqual({ fund: "#6e9da5", deep: "#83b3bb", tint: "#1b3236" });
    expect(contrastRatio(tint, DARK_SURFACES.paper)).toBeLessThan(AA_NON_TEXT);
  });

  it("keeps a sweep of colours readable as text, button fill and on its own tint", () => {
    const failures = sampleColors().flatMap((color) => {
      const { fund, deep, tint } = deriveDarkFundColors(color);
      const pairs: [string, string][] = [
        ...Object.values(DARK_SURFACES).map((surface): [string, string] => [fund, surface]),
        [fund, tint],
        [deep, tint],
        [deep, DARK_SURFACES.leaf],
      ];
      return pairs.filter(([text, background]) => contrastRatio(text, background) < AA_TEXT).map(([text, background]) => `${color}: ${text} on ${background}`);
    });

    expect(failures).toEqual([]);
  });

  it("writes the dark fund, with dark Leaf words on the primary button", () => {
    const { fund } = deriveDarkFundColors(DEFAULT_ACCENT_COLOR);
    const css = renderAccentCss(DEFAULT_ACCENT_COLOR);

    expect(css).toContain(`:root.dark{--fund:${fund};`);
    expect(css).toContain(`--primary-foreground:${DARK_SURFACES.leaf}`);
  });
});
