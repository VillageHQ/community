"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";

import { Field } from "@/components/form-field";
import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/platform/auth/auth-client";
import type { CommunityLogo } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";

import { SignInForm } from "./sign-in-form";

const TOO_MANY_MESSAGE = "Too many tries. Wait a minute and try again.";
const FAILED_MESSAGE = "We couldn't send that right now. Wait a minute and try again.";
const MISSING_EMAIL_MESSAGE = "Enter the email address your invite went to.";
const TOO_MANY_REQUESTS_STATUS = 429;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERROR_ID = "email-err";

type LinkState = { sentTo: string | null; errorMessage: string | null; email: string };

const INITIAL_STATE: LinkState = { sentTo: null, errorMessage: null, email: "" };

// One answer for every address, known or not, so the form never tells who is a member.
async function requestLink(_previousState: LinkState, formData: FormData): Promise<LinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return { sentTo: null, errorMessage: MISSING_EMAIL_MESSAGE, email };
  const { error } = await authClient.$fetch("/sign-in/magic-link", { method: "POST", body: { email } });
  if (!error) return { sentTo: email, errorMessage: null, email };
  return { sentTo: null, errorMessage: error.status === TOO_MANY_REQUESTS_STATUS ? TOO_MANY_MESSAGE : FAILED_MESSAGE, email };
}

type Community = { name: string; logo: CommunityLogo | null };

type SignInScreenProps = {
  community: Community;
  hosting?: string;
  // Off where no email can be sent (no mail set up, outside the demo): the password form leads.
  isLinkOn: boolean;
  returnPath: string | null;
  // Notes for Community-only arrivals (a new admin, a deleted account, a confirm link), above the form.
  notice?: ReactNode;
  // The demo's two one-click buttons.
  demo?: ReactNode;
};

// Founderhall's sign-in (lib/views-public.mjs signinPage, checkEmailPage): one card, the emailed link first.
// After a link is asked for, the same page says "Check your email", as Founderhall's POST /signin does.
export function SignInScreen({ community, hosting, isLinkOn, returnPath, notice, demo }: SignInScreenProps) {
  const [state, formAction, isPending] = useActionState(requestLink, INITIAL_STATE);
  const [isPasswordShown, setIsPasswordShown] = useState(!isLinkOn);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state.sentTo) document.title = `Check your email · ${community.name}`;
  }, [state.sentTo, community.name]);

  if (state.sentTo) {
    return (
      <PublicPage community={community}>
        <h1 className="fh-h2">Check your email</h1>
        <p className="fh-lede">
          If {state.sentTo} is a member of {community.name}, a sign-in link is on its way. It works once, for 15 minutes.
        </p>
        <p className="fh-small mt-4">
          <a href={ROUTES.signIn}>Use a different email</a>
        </p>
      </PublicPage>
    );
  }

  const hasError = Boolean(state.errorMessage);
  return (
    <PublicPage community={community} withCredit hosting={hosting}>
      <h1 className="fh-h2">Sign in to {community.name}</h1>
      <p className="fh-lede">{isPasswordShown && !isLinkOn ? "Sign in with your email and password." : "We email you a link that signs you in. No password."}</p>
      {notice}
      {isPasswordShown ? (
        <SignInForm returnPath={returnPath} initialEmail={email} onEmailChange={setEmail} />
      ) : (
        <form action={formAction} className="fh-field" noValidate>
          <Field htmlFor="email" label="Your email" error={state.errorMessage ? <span id={ERROR_ID}>{state.errorMessage}</span> : null}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@example.com"
              defaultValue={state.email || email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? ERROR_ID : undefined}
            />
          </Field>
          <Button type="submit" width="block" disabled={isPending} className="mt-[14px]">
            {isPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
      {demo}
      <p className="fh-small fh-muted mt-4">
        {community.name} is invite-only. If you were invited, use the address the invite went to.
      </p>
      {isLinkOn ? (
        <p className="fh-small mt-2">
          <button type="button" className="fh-linkbtn" onClick={() => setIsPasswordShown((isShown) => !isShown)}>
            {isPasswordShown ? "Email me a sign-in link instead" : "Sign in with a password"}
          </button>
        </p>
      ) : null}
    </PublicPage>
  );
}
