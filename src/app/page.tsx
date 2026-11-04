import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageCard } from "@/components/page-card";
import { SignOutForm } from "@/components/sign-out-form";
import { getAuth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { isAdminMember } from "@/lib/village/member-network";

export default async function HomePage() {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect(ROUTES.signIn);

  const { name, email, role } = session.user;

  return (
    <PageCard title={`Welcome, ${name}`}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{email}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{role}</dd>
      </dl>
      <nav aria-label="Community" className="grid gap-1 text-sm">
        <Link className="underline" href={ROUTES.network}>
          Your network
        </Link>
        {isAdminMember(session.user) ? (
          <Link className="underline" href={ROUTES.villageSettings}>
            Village settings
          </Link>
        ) : null}
      </nav>
      <SignOutForm />
    </PageCard>
  );
}
