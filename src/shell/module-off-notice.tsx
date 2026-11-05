"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MODULE_OFF_EVENT } from "@/platform/http/post-request";
import { ROUTES } from "@/platform/http/routes";

export function ModuleOffNotice() {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const show = () => setIsShown(true);
    window.addEventListener(MODULE_OFF_EVENT, show);
    return () => window.removeEventListener(MODULE_OFF_EVENT, show);
  }, []);

  if (!isShown) return null;
  return (
    <div
      role="alert"
      data-slot="module-off-notice"
      className="fixed inset-x-3.5 bottom-[104px] z-20 grid gap-3 rounded-card bg-card p-4 shadow-sheet lg:inset-x-auto lg:right-8 lg:bottom-8 lg:max-w-[420px]"
    >
      <div className="grid gap-1">
        <p className="type-label">This part of your community is turned off</p>
        <p className="type-small text-foreground-soft">An admin turned it off. Nothing was deleted. Everything else still works.</p>
      </div>
      <Button asChild size="lg">
        <a href={ROUTES.feed}>Go home</a>
      </Button>
    </div>
  );
}
