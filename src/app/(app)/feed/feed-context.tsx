"use client";

import { createContext, use, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

export type FeedViewer = { id: string; name: string; avatarUrl: string | null; isAdmin: boolean };

type FeedContextValue = {
  viewer: FeedViewer;
  announce: (message: string) => void;
  postAwaitingFocusRef: RefObject<string | null>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function useFeedContext() {
  const context = use(FeedContext);
  if (!context) throw new Error("useFeedContext needs a FeedProvider.");
  return context;
}

export function FeedProvider({ viewer, children }: { viewer: FeedViewer; children: ReactNode }) {
  const [announcement, announce] = useState("");
  const postAwaitingFocusRef = useRef<string | null>(null);
  const context = useMemo(() => ({ viewer, announce, postAwaitingFocusRef }), [viewer]);
  return (
    <FeedContext value={context}>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {children}
    </FeedContext>
  );
}
