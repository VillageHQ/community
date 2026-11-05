"use client";

import { useEffect, useRef } from "react";

const PHONE_LAYOUT_QUERY = "(max-width: 1023.98px)";
const VIEWPORT_EVENTS = ["resize", "scroll"] as const;

function fitToVisualViewport(element: HTMLElement, viewport: VisualViewport) {
  if (!window.matchMedia(PHONE_LAYOUT_QUERY).matches) {
    element.style.removeProperty("height");
    element.style.removeProperty("top");
    return;
  }
  element.style.height = `${viewport.height}px`;
  element.style.top = `${viewport.offsetTop}px`;
}

export function useVisualViewportFit<Element extends HTMLElement>() {
  const elementRef = useRef<Element>(null);

  useEffect(() => {
    const element = elementRef.current;
    const viewport = window.visualViewport;
    if (!element || !viewport) return undefined;

    const fit = () => fitToVisualViewport(element, viewport);
    fit();
    for (const event of VIEWPORT_EVENTS) viewport.addEventListener(event, fit);
    return () => {
      for (const event of VIEWPORT_EVENTS) viewport.removeEventListener(event, fit);
    };
  }, []);

  return elementRef;
}
