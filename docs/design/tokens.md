# VillageHQ/community design tokens

Direction: "The front room". Warm, tactile, full of faces. Reference: `mockup.html` in this folder.

## Accent: one input, six derived tokens

A fund stores one hex color. The server derives everything else per theme and writes CSS variables on `:root` and `.dark`. The mockup uses precomputed presets because it has no JavaScript.

| Token | Use | Rule |
| --- | --- | --- |
| `--accent` | Fills: primary buttons, own message bubbles, badges, checks | Exact brand color in light mode. In dark mode, raise OKLCH lightness until 3:1 against surface and canvas. |
| `--on-accent` | Text and icons on `--accent` | Whichever of `#ffffff` and `#000000` has higher contrast. |
| `--accent-text` | Accent-colored text, icons and active rings on surfaces | Shift OKLCH lightness away from the background until 4.5:1 on canvas, surface, sunk and soft. |
| `--accent-soft` | Tints: active nav, pinned post, soft buttons, tags | Fixed lightness (0.95 light, 0.315 dark), brand hue, chroma capped at 0.028 light, 0.045 dark. |
| `--accent-edge` | 1.5px inset edge on fills | `--accent` if it has 3:1 on surface, otherwise `--accent-text`. |
| `--focus` | `:focus-visible` outline, 3px with 3px offset | Same as `--accent-text`, so at least 3:1 on every surface. |

Why pure black: white and black meet at relative luminance 0.179, where both give 4.58:1, so that pair always clears AA. An ink like `#111` drops the worst case to about 4.35:1 and fails. Use tinted inks for body text only, never on `--accent`.

Security: validate the stored value with `/^#[0-9a-f]{6}$/i` before it reaches a style tag. It goes into CSS unescaped otherwise.

### Implementation

Tested in Node 24. It has no dependencies.

```ts
export type ThemeMode = "light" | "dark";

type LinearRgb = { red: number; green: number; blue: number };
type Oklch = { lightness: number; chroma: number; hue: number };

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const LIGHTNESS_STEP = 0.005;
const SOFT_MAX_CHROMA = { light: 0.028, dark: 0.045 };
const SOFT_LIGHTNESS = { light: 0.95, dark: 0.315 };

export const NEUTRALS = {
  light: { canvas: "#f8f6f0", surface: "#ffffff", sunk: "#f2efe7" },
  dark: { canvas: "#15140f", surface: "#201e18", sunk: "#2a2820" },
};

function hexToSrgbChannels(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => channel / 255);
}

function srgbToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function hexToLinear(hex: string): LinearRgb {
  const [red, green, blue] = hexToSrgbChannels(hex).map(srgbToLinear);
  return { red, green, blue };
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
  return [red, green, blue].every((channel) => channel >= -0.0001 && channel <= 1.0001);
}

function oklchToHex(color: Oklch) {
  let chroma = color.chroma;
  while (chroma > 0 && !isInSrgbGamut(oklchToLinear({ ...color, chroma }))) chroma -= 0.002;
  const { red, green, blue } = oklchToLinear({ ...color, chroma: Math.max(chroma, 0) });
  const channels = [red, green, blue].map((channel) =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(channel, 0)))) * 255)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
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
  return direction === 1 ? "#ffffff" : "#000000";
}

export function pickOnAccent(fillHex: string) {
  return contrastRatio(fillHex, "#ffffff") >= contrastRatio(fillHex, "#000000") ? "#ffffff" : "#000000";
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
```

### Results per accent

| Accent | Mode | `--accent` | `--on-accent` | `--accent-text` (worst case) | `--accent-soft` | `--accent-edge` on surface |
| --- | --- | --- | --- | --- | --- | --- |
| Village teal (default) | light | `#0f7f86` | `#ffffff` 4.77:1 | `#087980` 4.50:1 | `#daf5f6` | `#0f7f86` 4.77:1 |
| Village teal (default) | dark | `#0f7f86` | `#ffffff` 4.77:1 | `#49a8af` 4.55:1 | `#0f383b` | `#0f7f86` 3.49:1 |
| Sunbeam (light) | light | `#ffc93c` | `#000000` 13.67:1 | `#876705` 4.58:1 | `#f7eeda` | `#876705` 5.29:1 |
| Sunbeam (light) | dark | `#ffc93c` | `#000000` 13.67:1 | `#ffc93c` 8.41:1 | `#3c3015` | `#ffc93c` 10.85:1 |
| Midnight (dark) | light | `#14213d` | `#ffffff` 15.97:1 | `#14213d` 13.83:1 | `#e7effe` | `#14213d` 15.97:1 |
| Midnight (dark) | dark | `#59698b` | `#ffffff` 5.50:1 | `#8799bd` 4.53:1 | `#263149` | `#59698b` 3.03:1 |
| Coral (mid-tone) | light | `#e8604c` | `#000000` 6.21:1 | `#c13c2a` 4.56:1 | `#fee9e5` | `#e8604c` 3.38:1 |
| Coral (mid-tone) | dark | `#e8604c` | `#000000` 6.21:1 | `#f66d58` 4.52:1 | `#462924` | `#e8604c` 4.93:1 |
| Cobalt | light | `#2556e8` | `#ffffff` 5.87:1 | `#2556e8` 5.08:1 | `#e7effe` | `#2556e8` 5.87:1 |
| Cobalt | dark | `#295bed` | `#ffffff` 5.51:1 | `#6996ff` 4.58:1 | `#263149` | `#295bed` 3.03:1 |

### How contrast was checked

- Formula sweep: 5,832 colors (every 15th value per RGB channel) in both themes, 11,664 derivations, 0 failures. Worst cases: `--on-accent` 4.58:1, `--accent-text` 4.50:1, `--accent-edge` 3.00:1.
- Rendered page: every visible text node (578) in Chromium, for 5 accents in 2 themes, composited against its real background. 0 failures at 4.5:1 (3:1 for large text). Lowest ratio 4.52:1. Placeholders: 5.38:1 light, 6.06:1 dark.
- Not machine-checked in the render: icons. They use ink or `--accent-text` tokens, which meet 3:1 by the tables here.

## Neutrals

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#f8f6f0` | `#15140f` | Page. Warm, from Village gold-50 |
| `--surface` | `#ffffff` | `#201e18` | Cards |
| `--sunk` | `#f2efe7` | `#2a2820` | Comment bubbles, tags, composer input |
| `--line` | `#e7e2d6` | `#37342b` | Decorative hairlines |
| `--line-strong` | `#878b84` | `#8f8c80` | Field and outline-button boundaries, 3:1 |
| `--ink` | `#0c2427` | `#f7f4ea` | Primary text. Light value is Village turquoise-950 |
| `--ink-2` | `#3e4f50` | `#cfcbbe` | Secondary text |
| `--ink-3` | `#566463` | `#aaa698` | Meta text, placeholders |
| `--gold-soft` / `--gold-text` | `#f1ecd4` / `#74492c` | `#3a2c17` / `#e3d8a4` | "Win" tag, events. From Village gold |
| `--sage-soft` / `--sage-text` | `#deeeda` / `#2c5a2e` | `#223621` / `#b4dcae` | "Offer" tag |

| Pair | Light | Dark |
| --- | --- | --- |
| ink on canvas | 14.98 | 16.76 |
| ink on sunk | 14.09 | 13.41 |
| ink-2 on surface | 8.61 | 10.27 |
| ink-2 on sunk | 7.49 | 9.09 |
| ink-3 on surface | 6.18 | 6.84 |
| ink-3 on sunk | 5.38 | 6.06 |
| line-strong on surface (3:1 min) | 3.47 | 4.94 |
| line-strong on sunk (3:1 min) | 3.02 | 4.38 |

### Avatar initials

Pick a tint by hashing the member id. Never by name, so renames don't change colors.

| Tint | Light bg / fg | Dark bg / fg |
| --- | --- | --- |
| a | `#d5f2f0` / `#204b4f` | `#204b4f` / `#d5f2f0` |
| b | `#f1ecd4` / `#74492c` | `#4a3a1d` / `#f1ecd4` |
| c | `#f9ddd3` / `#7a3420` | `#5a2d20` / `#f9ddd3` |
| d | `#dce8f8` / `#24466f` | `#24466f` / `#dce8f8` |
| e | `#deeeda` / `#2c5a2e` | `#2c4a2d` / `#deeeda` |
| f | `#f3dde8` / `#6e2c4e` | `#5a2a43` / `#f3dde8` |

## Mapping to shadcn/ui

shadcn's `--accent` means a hover surface, not the brand color. In the app, use Village's names to avoid the clash.

| Design token | shadcn or Village variable |
| --- | --- |
| `--accent` | `--primary` |
| `--on-accent` | `--primary-foreground` |
| `--accent-soft` | `--accent` and `--secondary` |
| `--accent-text` | `--brand-emphasis` (Village's name for the same split) |
| `--accent-edge` | `--brand-edge` (new) |
| `--focus` | `--ring` |
| `--canvas` | `--background` |
| `--surface` | `--card`, `--popover` |
| `--sunk` | `--muted` |
| `--ink` | `--foreground` |
| `--ink-3` | `--muted-foreground` |
| `--line` | `--border` |
| `--line-strong` | `--input` |

## Shape

| Token | Value | Use |
| --- | --- | --- |
| `--radius-small` | 16px | Readouts, small insets |
| `--radius-field` | 20px | Connector cards, list rows, inner panels |
| `--radius-input` | 24px | Inputs, comment bubbles. Message bubbles use 24px with an 8px tail corner |
| `--radius-card` | 28px | Cards. 24px on phones |
| `--radius-panel` | 36px | Hero panels, intro panel |
| `--radius-full` | 999px | Buttons, chips, tags, nav items, reply field |
| Logo tile | 30% of its size | Matches Village's mark |

## Type

Recommendation: bundle **Figtree** (OFL, variable). Warm geometric shapes, and the same look on every OS. The system stack only looks like this on Apple devices. Use `next/font/local` with a committed woff2, so self-hosted builds need no network. `next/font/google` also self-hosts at runtime but downloads at build time.

Fallback, also what the mockup renders: `"Avenir Next", Avenir, "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Avenir Next only approximates Figtree, which was not rendered in this mockup. Layout held with Arial, Verdana and system-ui substituted.

| Style | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| Display | 44 / 50 | 700 | -0.022em |
| H1 | 32 / 38 | 700 | -0.018em |
| H2 | 24 / 30 | 700 | -0.012em |
| H3 | 19 / 26 | 700 | -0.006em |
| Body large, posts | 17 / 27 | 500 | 0 |
| Body | 16 / 24 | 500 | 0 |
| Small | 14 / 20 | 500 | 0 |
| Micro, tags | 13 / 18 | 600 | 0 |
| Tab bar only | 12 / 16 | 600 | 0 |

## Spacing

Base 4px. Steps: 4, 8, 12, 16, 20, 24, 28, 32, 40, 56, 64.
Card padding 24 (18 on phones). Page gutter 40 (14 on phones). Card gap 20. Sidebar 264px wide. Feed column about 612px, rail 296px.

## Controls

| Control | Height | Padding | Font |
| --- | --- | --- | --- |
| Button small | 44 | 0 18 | 15 / 700 |
| Button default | 48 | 0 24 | 16 / 700 |
| Button large | 56 | 0 32 | 17 / 700 |
| Button hero | 64 | 0 40 | 18 / 700 |
| Icon button | 44 or 48 | Circle | 22px icon |
| Chip, reaction | 44 | 0 16-18 | 15 / 600-700 |
| Nav item | 50 | 0 16 | 16 / 600, 700 when active |
| Field | 56 (48 compact) | 0 20 | 16 / 500 |
| Hero search | 76 | Holds a large button | 20 / 600 |
| Tab bar item | 56 | Five columns | 12 / 600 |

Button variants: primary (`--accent`), soft (`--accent-soft`), outline (surface with `--line-strong`), quiet (transparent).

Icons: Lucide, which the repo already has, at stroke 2. No emoji.

## Elevation

- Panel, light: `0 1px 2px rgb(40 34 20 / .05), 0 8px 24px rgb(40 34 20 / .06)`. Adapted from Village's `--shadow-panel`.
- Panel, dark: `0 0 0 1px #2d2a22, 0 8px 24px rgb(0 0 0 / .28)`.
- Primary button, adapted from Village's `--shadow-cta`: `inset 0 0 0 1.5px var(--accent-edge), inset 0 1px 0 rgb(255 255 255 / .24), 0 1px 2px rgb(30 30 20 / .18), 0 6px 14px -6px color-mix(in srgb, var(--accent) 60%, transparent)`. Dark mode drops the colored glow.
- Press: `translateY(1px)`. Hover: `translateY(-1px)`. Honor `prefers-reduced-motion`.

## What came from Village

- Turquoise scale: default accent `#0f7f86` sits between turquoise-500 and 600. Ink is turquoise-950.
- Gold scale: warm neutrals, "Win" tag.
- `--brand` and `--brand-emphasis` split: fills versus text.
- CTA and panel shadows, and fully rounded controls (`rounded-full` is the landing page's most used radius).
- The network motif: avatars joined by thin lines, from the village.ai hero.
- Bold, tightly tracked headings.
- The mark: its gradient `#2DBFD4`, `#1DA8BC`, `#17A97C`. The real asset (`landing/public/village-icon.png`) is a rounded square, not a circle, so the mockup draws a rounded square.

What we changed on purpose: Village's white text on its teal CTA reaches only 2.85:1 on `#1DA8BC`, so the default accent is deeper. Village's 8px control radius and near-black primary button read as enterprise, so we use pills and the accent.

## Decisions to confirm

These appear in the mockup but aren't built or promised yet:

- **"Not now" on the consent screen.** The current flow reads "Share your network to join". The mockup lets a founder in without sharing and holds back network search only.
- **"Ask me about" and the "Coming up" event card** are design proposals, not specified features.
- Member counts and setup time estimates are placeholder content.

Consent copy keeps every disclosure from `src/app/network/consent-step.tsx`, reworded.

Logo uploads: treat SVG as untrusted. Sanitize it or render it only through `<img>`.
