"use client";

import { Button, ButtonRow } from "@/components/ui/button";

// A page inside the app that failed to load: Founderhall's dashed empty box, with a way to try again.
export default function AppError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="fh-empty">
      <h1 className="fh-h2">This page didn’t load</h1>
      <p>Something went wrong on our side. Try again, and if it keeps happening, tell your admin.</p>
      <ButtonRow className="mt-3.5">
        <Button type="button" variant="secondary" onClick={retry}>
          Try again
        </Button>
      </ButtonRow>
    </div>
  );
}
