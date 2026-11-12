import Link from "next/link";

import { BackLink } from "@/components/page-header";
import { ROUTES } from "@/platform/http/routes";

export default function IntroNotFound() {
  return (
    <>
      <BackLink href={ROUTES.intros}>Your intros</BackLink>
      <div data-slot="empty-state" className="fh-empty">
        <h1 className="fh-h2">This intro isn’t available</h1>
        <p>
          It may have been removed, or it belongs to someone else. <Link href={ROUTES.intros}>Your intros</Link>.
        </p>
      </div>
    </>
  );
}
