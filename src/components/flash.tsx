"use client";

import { cn } from "cn";
import { CircleCheck, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Founderhall's flash (crop flash-ok.png): after an action, a note at the top of the page you land on says what
// happened. It replaces toasts. ok = Spine tint with a check; needs = Ribbon tint with a clock.
export const FLASH_KINDS = { ok: "ok", needs: "needs" } as const;

export type FlashKind = (typeof FLASH_KINDS)[keyof typeof FLASH_KINDS];

export function FlashNote({ kind = FLASH_KINDS.ok, children, className }: { kind?: FlashKind; children: ReactNode; className?: string }) {
  const Icon = kind === FLASH_KINDS.ok ? CircleCheck : Clock;
  return (
    <div data-slot="flash" role="status" className={cn("fh-note fh-flash", kind === FLASH_KINDS.ok ? "fh-ok" : "fh-needs", className)}>
      <Icon aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>{children}</span>
    </div>
  );
}

type Flash = { text: string; kind: FlashKind; path: string };

type FlashOptions = { kind?: FlashKind; on?: string };

const FlashContext = createContext<{ flash: Flash | null; show: (text: string, options?: FlashOptions) => void } | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [flash, setFlash] = useState<Flash | null>(null);
  const shownOn = useRef<string | null>(null);

  // A flash shows on the page it was meant for, then goes once the member moves on.
  useEffect(() => {
    if (!flash) return;
    if (pathname === flash.path) shownOn.current = pathname;
    else if (shownOn.current !== null) {
      shownOn.current = null;
      setFlash(null);
    }
  }, [pathname, flash]);

  const show = useCallback(
    (text: string, { kind = FLASH_KINDS.ok, on }: FlashOptions = {}) => {
      shownOn.current = null;
      setFlash({ text, kind, path: on ?? pathname });
    },
    [pathname],
  );

  const value = useMemo(() => ({ flash, show }), [flash, show]);
  return <FlashContext value={value}>{children}</FlashContext>;
}

// show("Asked. We emailed your note.") flashes on this page; show(text, { on: "/intros" }) on the page you go to next.
export function useFlash() {
  const context = use(FlashContext);
  if (!context) throw new Error("useFlash needs the app shell's FlashProvider");
  return context.show;
}

// The top of main, where the shell shows the flash.
export function FlashSlot() {
  const pathname = usePathname();
  const context = use(FlashContext);
  const flash = context?.flash;
  if (!flash || flash.path !== pathname) return null;
  return <FlashNote kind={flash.kind}>{flash.text}</FlashNote>;
}
