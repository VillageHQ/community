export type ThemeMode = "light" | "dark";

type LinearRgb = { red: number; green: number; blue: number };
type Oklch = { lightness: number; chroma: number; hue: number };

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const LIGHTNESS_STEP = 0.005;
const CHROMA_STEP = 0.002;
const GAMUT_TOLERANCE = 0.0001;
const SOFT_MAX_CHROMA = { light: 0.028, dark: 0.045 };
const SOFT_LIGHTNESS = { light: 0.95, dark: 0.315 };
const WHITE = "#ffffff";
const BLACK = "#000000";
const HEX_RADIX = 16;
const CONTRAST_DECIMALS = 2;

const ACCENT_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_ACCENT_COLOR = "#0f7f86";

export const ACCENT_PRESETS = [
  { name: "Village teal", color: DEFAULT_ACCENT_COLOR },
  { name: "Sunbeam", color: "#ffc93c" },
  { name: "Midnight", color: "#14213d" },
  { name: "Coral", color: "#e8604c" },
  { name: "Cobalt", color: "#2556e8" },
] as const;

export const NEUTRALS = {
  light: { canvas: "#f8f6f0", surface: "#ffffff", sunk: "#f2efe7" },
  dark: { canvas: "#15140f", surface: "#201e18", sunk: "#2a2820" },
};

function hexToLinear(hex: string): LinearRgb {
  const value = Number.parseInt(hex.slice(1), HEX_RADIX);
  return {
    red: srgbToLinear(((value >> 16) & 255) / 255),
    green: srgbToLinear(((value >> 8) & 255) / 255),
    blue: srgbToLinear((value & 255) / 255),
  };
}

function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

export function relativeLuminance(hex: string) {
  const { red, green, blue } = hexToLinear(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(firstHex: string, secondHex: string) {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function hexToOklch(hex: string): Oklch {
  const { red, green, blue } = hexToLinear(hex);
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const b = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
  return {
    lightness: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    chroma: Math.hypot(a, b),
    hue: Math.atan2(b, a),
  };
}

function oklchToLinear({ lightness, chroma, hue }: Oklch): LinearRgb {
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    red: 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    green: -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    blue: -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  };
}

function isInSrgbGamut({ red, green, blue }: LinearRgb) {
  return [red, green, blue].every(
    (channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE,
  );
}

function linearChannelToHex(channel: number) {
  return Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(channel, 0)))) * 255)
    .toString(HEX_RADIX)
    .padStart(2, "0");
}

function oklchToHex(color: Oklch) {
  let chroma = color.chroma;
  while (chroma > 0 && !isInSrgbGamut(oklchToLinear({ ...color, chroma }))) chroma -= CHROMA_STEP;
  const { red, green, blue } = oklchToLinear({ ...color, chroma: Math.max(chroma, 0) });
  return `#${[red, green, blue].map(linearChannelToHex).join("")}`;
}

function shiftUntilContrast(hex: string, backgrounds: string[], target: number, direction: 1 | -1) {
  const color = hexToOklch(hex);
  let lightness = color.lightness;
  let candidate = hex;
  while (lightness >= 0 && lightness <= 1) {
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= target)) return candidate;
    lightness += direction * LIGHTNESS_STEP;
    candidate = oklchToHex({ ...color, lightness });
  }
  return direction === 1 ? WHITE : BLACK;
}

export function pickOnAccent(fillHex: string) {
  return contrastRatio(fillHex, WHITE) >= contrastRatio(fillHex, BLACK) ? WHITE : BLACK;
}

export function deriveAccentTokens(brandHex: string, mode: ThemeMode) {
  const { canvas, surface, sunk } = NEUTRALS[mode];
  const towardsContrast = mode === "light" ? -1 : 1;
  const brand = hexToOklch(brandHex);
  const accent = mode === "dark" ? shiftUntilContrast(brandHex, [surface, canvas], AA_NON_TEXT, 1) : brandHex;
  const accentSoft = oklchToHex({
    lightness: SOFT_LIGHTNESS[mode],
    chroma: Math.min(brand.chroma, SOFT_MAX_CHROMA[mode]),
    hue: brand.hue,
  });
  const accentText = shiftUntilContrast(brandHex, [canvas, surface, sunk, accentSoft], AA_TEXT, towardsContrast);
  const accentEdge = contrastRatio(accent, surface) >= AA_NON_TEXT ? accent : accentText;
  return { accent, onAccent: pickOnAccent(accent), accentText, accentSoft, accentEdge, focusRing: accentText };
}

// Founderhall's fund colour (its lib/color.mjs): the admin's colour, darkened in steps of ×0.92 (same hue) until it
// reads at 4.5:1 on Leaf; "deep" is the fund ×0.75 (hover, text on the tint); "tint" is the fund mixed 84 % toward white.
export const LEAF = "#fffdf8";
const FUND_DARKEN_STEP = 0.92;
const FUND_MAX_STEPS = 40;
const FUND_DEEP_FACTOR = 0.75;
const FUND_TINT_MIX = 0.84;
const CHANNEL_MAX = 255;

function hexToChannels(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), HEX_RADIX));
}

function channelsToHex(channels: number[]) {
  const pairs = channels.map((channel) => Math.max(0, Math.min(CHANNEL_MAX, Math.round(channel))).toString(HEX_RADIX).padStart(2, "0"));
  return `#${pairs.join("")}`;
}

export function deriveFundColors(brandHex: string) {
  let channels = hexToChannels(brandHex);
  let fund = brandHex.toLowerCase();
  for (let step = 0; step < FUND_MAX_STEPS && contrastRatio(fund, LEAF) < AA_TEXT; step += 1) {
    channels = channels.map((channel) => channel * FUND_DARKEN_STEP);
    fund = channelsToHex(channels);
  }
  const fundChannels = hexToChannels(fund);
  return {
    fund,
    deep: channelsToHex(fundChannels.map((channel) => channel * FUND_DEEP_FACTOR)),
    tint: channelsToHex(fundChannels.map((channel) => channel + (CHANNEL_MAX - channel) * FUND_TINT_MIX)),
    isAdjusted: fund !== brandHex.toLowerCase(),
  };
}

export function parseAccentColor(value: unknown) {
  if (typeof value !== "string" || !ACCENT_COLOR_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

function toLightAccentVariables(brandHex: string) {
  const { fund, deep, tint } = deriveFundColors(brandHex);
  return {
    "--fund": fund,
    "--fund-deep": deep,
    "--fund-tint": tint,
    "--primary": fund,
    "--primary-foreground": LEAF,
    "--secondary": tint,
    "--secondary-foreground": deep,
    "--accent": tint,
    "--accent-foreground": deep,
    "--brand-emphasis": fund,
    "--brand-edge": fund,
    "--ring": fund,
  };
}

export function toAccentVariables(brandHex: string, mode: ThemeMode) {
  if (mode === "light") return toLightAccentVariables(brandHex);
  // Dark mode waits on the owner: the fund takes its readable text tone on the dark sheets and its tint stays dark.
  const { accent, onAccent, accentText, accentSoft, accentEdge, focusRing } = deriveAccentTokens(brandHex, mode);
  return {
    "--fund": accentText,
    "--fund-deep": accentText,
    "--fund-tint": accentSoft,
    "--primary": accent,
    "--primary-foreground": onAccent,
    "--secondary": accentSoft,
    "--secondary-foreground": accentText,
    "--accent": accentSoft,
    "--accent-foreground": accentText,
    "--brand-emphasis": accentText,
    "--brand-edge": accentEdge,
    "--ring": focusRing,
  };
}

function toDeclarations(variables: Record<string, string>) {
  return Object.entries(variables)
    .map(([name, color]) => `${name}:${color}`)
    .join(";");
}

export function renderAccentCss(storedColor: unknown) {
  const color = parseAccentColor(storedColor) ?? DEFAULT_ACCENT_COLOR;
  const light = toDeclarations(toAccentVariables(color, "light"));
  const dark = toDeclarations(toAccentVariables(color, "dark"));
  return `:root{${light}}:root.dark{${dark}}`;
}

export function describeButtonContrast(brandHex: string) {
  const { fund } = deriveFundColors(brandHex);
  return { textColorName: "White", ratio: contrastRatio(fund, LEAF).toFixed(CONTRAST_DECIMALS) };
}
