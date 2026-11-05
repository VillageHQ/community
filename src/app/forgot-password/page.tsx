import { ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";

import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.forgotPassword };

function WithoutEmail() {
  return (
    <div className="mt-7 grid gap-4">
      <p className="type-lead text-foreground-soft">This community doesn&apos;t send email, so we can&apos;t send you a reset link.</p>
      <section className="grid gap-2 rounded-panel bg-card p-5 shadow-panel sm:p-7">
        <h2 className="type-h3 flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
          If you&apos;re a member
        </h2>
        <p className="text-foreground-soft">
          Ask your admin to remove your account and invite you again. That creates a new account. Your old private messages stay on the old account, and you won&apos;t get them
          back. Nobody can set your password for you, not even an admin, because that would let them read your messages. Your admin can also turn email on, then you can reset
          it yourself here.
        </p>
      </section>
      <section className="grid gap-3 rounded-panel bg-card p-5 shadow-panel sm:p-7">
        <h2 className="type-h3 flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-brand-emphasis" />
          If you&apos;re an admin
        </h2>
        <p className="text-foreground-soft">You can choose a new password with the setup token from your deployment.</p>
        <div>
          <Button asChild size="lg" variant="outline" className="max-sm:w-full">
            <Link href={ROUTES.recoverAdmin}>I lost my admin password</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function WithEmail() {
  return (
    <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
      <ForgotPasswordForm />
    </div>
  );
}

export default async function ForgotPasswordPage() {
  const community = await readBrandingForPage();
  const isEmailConfigured = readResendConfig(process.env) !== null;

  return (
    <SplitLayout community={community} note={<CommunityNote community={community}>It happens. Let&apos;s get you back in.</CommunityNote>}>
      <div className="flex min-h-[60dvh] flex-col justify-center lg:min-h-[calc(100dvh-140px)]">
        <h1 className="type-h1">Forgot your password?</h1>
        {isEmailConfigured ? <WithEmail /> : <WithoutEmail />}
        <div className="mt-5">
          <Button asChild variant="quiet">
            <Link href={ROUTES.signIn}>Back to sign in</Link>
          </Button>
        </div>
      </div>
    </SplitLayout>
  );
}
