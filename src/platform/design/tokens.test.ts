import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "./accent";
import { parseTheme, THEMES } from "./theme";

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const TAB_BAR_HEIGHT_PX = 88;
const STYLES = readFileSync(resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

function readBlock(selector: string) {
  const start = STYLES.indexOf(`${selector} {`);
  const block = STYLES.slice(start, STYLES.indexOf("\n}", start));
  const colors = [...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6});/g)];
  return new Map(colors.map(([, name, color]) => [name, color]));
}

function readColor(tokens: Map<string | undefined, string | undefined>, name: string) {
  const color = tokens.get(name);
  if (!color) throw new Error(`Missing token ${name}`);
  return color;
}

const TEXT_PAIRS = [
  ["--foreground", "--background"],
  ["--foreground", "--muted"],
  ["--foreground-soft", "--card"],
  ["--foreground-soft", "--muted"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--destructive-foreground", "--destructive"],
  ["--destructive-text", "--destructive-soft"],
  ["--destructive-text", "--card"],
  ["--gold-text", "--gold-soft"],
  ["--sage-text", "--sage-soft"],
  ["--tint-a-fg", "--tint-a-bg"],
  ["--tint-b-fg", "--tint-b-bg"],
  ["--tint-c-fg", "--tint-c-bg"],
  ["--tint-d-fg", "--tint-d-bg"],
  ["--tint-e-fg", "--tint-e-bg"],
  ["--tint-f-fg", "--tint-f-bg"],
] as const;

// Founderhall's own names (design-system.md §1.1), the pairs its parts draw.
const FOUNDERHALL_TEXT_PAIRS = [
  ["--ink", "--paper"],
  ["--ink", "--leaf"],
  ["--ink", "--vellum"],
  ["--ink", "--side"],
  ["--paper", "--ink"],
  ["--graphite", "--paper"],
  ["--graphite", "--leaf"],
  ["--graphite", "--vellum"],
  ["--graphite", "--side"],
  ["--spine", "--spine-tint"],
  ["--spine", "--leaf"],
  ["--ribbon", "--ribbon-tint"],
  ["--ribbon", "--leaf"],
] as const;

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("the %s tokens", (_theme, selector) => {
  const tokens = readBlock(selector);

  it("keep every text pair readable", () => {
    const failures = TEXT_PAIRS.filter(
      ([text, background]) => contrastRatio(readColor(tokens, text), readColor(tokens, background)) < AA_TEXT,
    );

    expect(failures).toEqual([]);
  });

  it("keep Founderhall's text pairs readable", () => {
    const failures = FOUNDERHALL_TEXT_PAIRS.filter(
      ([text, background]) => contrastRatio(readColor(tokens, text), readColor(tokens, background)) < AA_TEXT,
    );

    expect(failures).toEqual([]);
  });

  it("keep field boundaries visible", () => {
    expect(contrastRatio(readColor(tokens, "--input"), readColor(tokens, "--card"))).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(readColor(tokens, "--input"), readColor(tokens, "--muted"))).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe("the dark parts with a literal colour", () => {
  const tokens = readBlock(".dark");
  const leaf = readColor(tokens, "--leaf");

  it("keep placeholders readable and dashed edges and the off switch visible", () => {
    expect(contrastRatio(readColor(tokens, "--fh-placeholder"), leaf)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(readColor(tokens, "--fh-dash"), leaf)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(readColor(tokens, "--fh-switch-off"), leaf)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(readColor(tokens, "--ink"), readColor(tokens, "--fh-chip-hover"))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the page's scroll room", () => {
  it("keeps focused fields clear of the phone tab bar", () => {
    const [, bottomPadding] = STYLES.match(/scroll-padding-bottom:\s*(\d+)px/) ?? [];

    expect(Number(bottomPadding)).toBeGreaterThanOrEqual(TAB_BAR_HEIGHT_PX);
  });
});

describe("the theme cookie", () => {
  it.each([THEMES.light, THEMES.dark])("accepts %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each(["", "blue", "dark;}", undefined])("ignores %j, so the page follows the system", (value) => {
    expect(parseTheme(value)).toBeNull();
  });
});
