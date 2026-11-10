import localFont from "next/font/local";

export const figtree = localFont({
  src: "../../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-figtree",
});

export const figtreeExtended = localFont({
  src: "../../node_modules/@fontsource-variable/figtree/files/figtree-latin-ext-wght-normal.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-figtree-extended",
});

// Headings: the fund's voice, set in a serif. Self-hosted like Figtree, so no page calls a font service.
export const sourceSerif = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2", weight: "200 900", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-source-serif",
});
