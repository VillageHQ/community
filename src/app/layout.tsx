import { cn } from "cn";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { SkipLink } from "@/components/skip-link";
import { readBrandingForPage } from "@/lib/branding/branding";
import { toRootMetadata } from "@/lib/branding/page-metadata";
import { renderAccentCss } from "@/lib/design/accent";
import { DARK_CLASS, parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE, THEMES } from "@/lib/design/theme";

import { figtree, figtreeExtended } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return toRootMetadata(await readBrandingForPage());
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const { accentColor } = await readBrandingForPage();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(figtree.variable, figtreeExtended.variable, theme === THEMES.dark && DARK_CLASS)}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: renderAccentCss(accentColor) }} />
        {theme === null ? <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} /> : null}
      </head>
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
