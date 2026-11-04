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
