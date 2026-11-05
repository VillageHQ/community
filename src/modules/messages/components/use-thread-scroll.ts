"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

const NEAR_BOTTOM_PX = 120;

function readIsNearBottom({ scrollHeight, scrollTop, clientHeight }: HTMLElement) {
  return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
}

function scrollElementToBottom(element: HTMLElement | null) {
  if (element) element.scrollTop = element.scrollHeight;
}

function keepBottomWhenResized(containerRef: RefObject<HTMLElement | null>, isNearBottomRef: RefObject<boolean>) {
  const container = containerRef.current;
  if (!container) return undefined;
  const observer = new ResizeObserver(() => {
    if (isNearBottomRef.current) scrollElementToBottom(container);
  });
  observer.observe(container);
  return () => observer.disconnect();
}

type ThreadScrollInput = { newestKey: string | null; oldestKey: string | null; isNewestMine: boolean };

export function useThreadScroll({ newestKey, oldestKey, isNewestMine }: ThreadScrollInput) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prependAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const latestNewestKeyRef = useRef(newestKey);
  const [newestKeyWhenAway, setNewestKeyWhenAway] = useState<string | null>(null);
  const [isAway, setIsAway] = useState(false);

  useLayoutEffect(() => {
    scrollElementToBottom(containerRef.current);
    return keepBottomWhenResized(containerRef, isNearBottomRef);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const anchor = prependAnchorRef.current;
    if (!container || !anchor) return;
    container.scrollTop = anchor.scrollTop + (container.scrollHeight - anchor.scrollHeight);
    prependAnchorRef.current = null;
  }, [oldestKey]);

  useLayoutEffect(() => {
    latestNewestKeyRef.current = newestKey;
    if (isNearBottomRef.current || isNewestMine) scrollElementToBottom(containerRef.current);
  }, [newestKey, isNewestMine]);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = readIsNearBottom(container);
    if (isNearBottom === isNearBottomRef.current) return;
    isNearBottomRef.current = isNearBottom;
    setIsAway(!isNearBottom);
    setNewestKeyWhenAway(latestNewestKeyRef.current);
  }, []);

  const rememberScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (container) prependAnchorRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
  }, []);

  const scrollToNewest = useCallback(() => scrollElementToBottom(containerRef.current), []);

  return {
    containerRef,
    onScroll,
    rememberScrollPosition,
    scrollToNewest,
    hasUnseenMessages: isAway && newestKey !== newestKeyWhenAway,
  };
}
