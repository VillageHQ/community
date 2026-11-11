import { Note } from "@/components/ui/note";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/platform/demo/mode";
import { API_ROUTES } from "@/platform/http/routes";

const FAILURE_COPY: Record<string, string> = {
  missing: "The demo accounts aren't here yet. The demo may still be starting, or resetting for the night. Try again in a minute.",
  unknown: "Pick one of the two demo accounts.",
};

const DEMO_ORDER: readonly DemoAccount[] = ["admin", "member"];

// Only rendered with DEMO_MODE=true. A plain form, so it works before any script loads (Founderhall's demo-login).
export function DemoSignIn({ failure }: { failure: string | undefined }) {
  const failureCopy = failure ? (FAILURE_COPY[failure] ?? FAILURE_COPY.missing) : null;
  return (
    <form method="post" action={API_ROUTES.demoSignIn} className="mt-[18px]">
      <p className="fh-label">Or look around without an email</p>
      {failureCopy ? (
        <Note kind="needs" role="alert" className="mb-2">
          {failureCopy}
        </Note>
      ) : null}
      {DEMO_ORDER.map((who) => (
        <Button key={who} type="submit" name="who" value={who} variant="secondary" width="block" className="mt-2">
          {DEMO_ACCOUNTS[who].label}
        </Button>
      ))}
    </form>
  );
}
