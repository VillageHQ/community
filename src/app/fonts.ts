import localFont from "next/font/local";

// Founderhall's three faces, self-hosted so no page calls a font service (licence: src/app/_fonts/OFL.txt).
// Body and everything you click: IBM Plex Sans.
export const plexSans = localFont({
  src: "./_fonts/IBMPlexSans.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-plex-sans",
});

// Codes (reply codes, keys, embed snippets): IBM Plex Mono.
export const plexMono = localFont({
  src: [
    { path: "./_fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./_fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-plex-mono",
});

// Titles and people's names: Source Serif 4.
export const sourceSerif = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2", weight: "200 900", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-source-serif",
});

export const FONT_VARIABLES = [plexSans.variable, plexMono.variable, sourceSerif.variable].join(" ");
