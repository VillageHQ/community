import { cn } from "cn";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { SkipLink } from "@/components/skip-link";
import { RunsOnVillageProvider } from "@/components/village-mark";
import { readRunsOnVillageSafely } from "@/shell/enabled-modules";
import { readBrandingForPage } from "@/platform/branding/branding";
import { toRootMetadata } from "@/platform/branding/page-metadata";
import { renderAccentCss } from "@/platform/design/accent";
import { DARK_CLASS, parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE, THEMES } from "@/platform/design/theme";

import { figtree, figtreeExtended } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return toRootMetadata(await readBrandingForPage());
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const [{ accentColor }, runsOnVillage] = await Promise.all([readBrandingForPage(), readRunsOnVillageSafely()]);

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
        <RunsOnVillageProvider value={runsOnVillage}>{children}</RunsOnVillageProvider>
      </body>
    </html>
  );
}
