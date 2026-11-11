import { cn } from "cn";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { DemoBanner } from "@/components/demo-banner";
import { SkipLink } from "@/components/skip-link";
import { RunsOnVillageProvider } from "@/components/village-mark";
import { readRunsOnVillageSafely } from "@/shell/enabled-modules";
import { readBrandingForPage } from "@/platform/branding/branding";
import { toRootMetadata } from "@/platform/branding/page-metadata";
import { isDemoMode } from "@/platform/demo/mode";
import { renderAccentCss } from "@/platform/design/accent";
import { DARK_CLASS, parseTheme, SYSTEM_THEME_SCRIPT, THEME_COOKIE, THEMES } from "@/platform/design/theme";

import { FONT_VARIABLES } from "./fonts";
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
      className={cn(FONT_VARIABLES, theme === THEMES.dark && DARK_CLASS)}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: renderAccentCss(accentColor) }} />
        {theme === null ? <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} /> : null}
      </head>
      <body>
        <SkipLink />
        {isDemoMode(process.env) ? <DemoBanner /> : null}
        <RunsOnVillageProvider value={runsOnVillage}>{children}</RunsOnVillageProvider>
      </body>
    </html>
  );
}
