"use client";

import { useEffect, useRef } from "react";

export function useFocusOnFailure(failure: { errorMessage: string | null }) {
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (failure.errorMessage) fieldRef.current?.focus();
  }, [failure]);

  return fieldRef;
}
