"use client";

import { createContext, use, useId, type ReactNode } from "react";

const DEFAULT_MARK_SIZE_PX = 18;

export function VillageMark({ sizePx = DEFAULT_MARK_SIZE_PX }: { sizePx?: number }) {
  const gradientId = useId();
  return (
    <svg width={sizePx} height={sizePx} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dbfd4" />
          <stop offset=".5" stopColor="#1da8bc" />
          <stop offset="1" stopColor="#17a97c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <path d="M20 19.5h7.6l4.6 16.7 4.7-16.7h7.1L36 44.5h-7.9z" fill="#fff" />
    </svg>
  );
}

const RunsOnVillageContext = createContext(true);

export function RunsOnVillageProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <RunsOnVillageContext.Provider value={value}>{children}</RunsOnVillageContext.Provider>;
}

export function OnlyOnVillage({ children, otherwise = null }: { children: ReactNode; otherwise?: ReactNode }) {
  return use(RunsOnVillageContext) ? children : otherwise;
}
