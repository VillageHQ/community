"use client";

import { ErrorState, RetryButton } from "@/components/error-state";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { DEFAULT_ACCENT_COLOR, renderAccentCss } from "@/lib/design/accent";
import { SYSTEM_THEME_SCRIPT } from "@/lib/design/theme";

import { figtree, figtreeExtended } from "./fonts";
import "./globals.css";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} ${figtreeExtended.variable}`}>
      <head>
        <title>Something went wrong</title>
        <style dangerouslySetInnerHTML={{ __html: renderAccentCss(DEFAULT_ACCENT_COLOR) }} />
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
      </head>
      <body>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-dvh items-center justify-center px-3.5 py-10">
          <div className="w-full max-w-[640px] rounded-panel bg-card shadow-panel">
            <ErrorState
              headingLevel="h1"
              title="Something went wrong"
              description="This site couldn't load. Try again in a moment. If you run this site, its database may be unreachable."
            >
              <RetryButton onClick={retry} />
            </ErrorState>
          </div>
        </main>
      </body>
    </html>
  );
}
