import { redirect } from "next/navigation";

import { PageCard } from "@/components/page-card";
import { getDatabase } from "@/database/client";
import { isFirstAdminClaimed } from "@/lib/first-admin";
import { ROUTES } from "@/lib/routes";

import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!(await isFirstAdminClaimed(getDatabase()))) redirect(ROUTES.setup);

  return (
    <PageCard title="Sign in">
      <SignInForm />
    </PageCard>
  );
}
