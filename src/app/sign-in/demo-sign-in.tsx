import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, DEMO_NOTE } from "@/platform/demo/mode";
import { API_ROUTES } from "@/platform/http/routes";

const FAILURE_COPY: Record<string, string> = {
  missing: "The demo accounts aren't here yet. The demo may still be starting, or resetting for the night. Try again in a minute.",
  unknown: "Pick one of the two demo accounts.",
};

// Only rendered with DEMO_MODE=true. A plain form, so it works before any script loads.
export function DemoSignIn({ failure }: { failure: string | undefined }) {
  const failureCopy = failure ? (FAILURE_COPY[failure] ?? FAILURE_COPY.missing) : null;
  return (
    <section aria-labelledby="demo-sign-in-title" className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
      <h2 id="demo-sign-in-title" className="type-h3">
        Try the demo
      </h2>
      <p className="type-small mt-1.5 text-foreground-soft">One click, no password and no email. {DEMO_NOTE}</p>
      {failureCopy ? (
        <p role="alert" className="type-small mt-3 font-bold text-destructive-text">
          {failureCopy}
        </p>
      ) : null}
      <form method="post" action={API_ROUTES.demoSignIn} className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <Button type="submit" name="who" value="member">
          {DEMO_ACCOUNTS.member.label}
        </Button>
        <Button type="submit" name="who" value="admin" variant="soft">
          {DEMO_ACCOUNTS.admin.label}
        </Button>
      </form>
    </section>
  );
}
