"use client";

import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeEmailConfirmation } from "@/modules/members/contract-email-confirmation-copy";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

import type { WelcomeContext } from "./welcome-context";

function resendConfirmation() {
  return postNetworkRequest(API_ROUTES.networkConfirmation, {}, acknowledgedResponseSchema);
}

function ResendConfirmation() {
  const resendMutation = useMutation({ mutationFn: resendConfirmation });
  return (
    <>
      <Button type="button" size="lg" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate()}>
        {resendMutation.isPending ? "Sending…" : "Send the link again"}
      </Button>
      <FormError message={resendMutation.error?.message ?? null} />
      {resendMutation.isSuccess ? <Alert variant="success">{resendMutation.data.message}</Alert> : null}
    </>
  );
}

type EmailConfirmationNoticeProps = { welcome: WelcomeContext; nextAction?: ReactNode };

export function EmailConfirmationNotice({ welcome, nextAction }: EmailConfirmationNoticeProps) {
  const { community, isEmailConfigured = false, memberEmail } = welcome;
  const { title, description } = describeEmailConfirmation(community.name, isEmailConfigured);
  return (
    <EmptyState headingLevel="h1" icon={MailCheck} title={title} description={description}>
      {memberEmail ? <p className="type-small wrap-anywhere text-muted-foreground">Your email: {memberEmail}</p> : null}
      {isEmailConfigured ? <ResendConfirmation /> : null}
      {nextAction ?? (
        <Button asChild variant={isEmailConfigured ? "quiet" : "primary"} size="lg">
          <Link href={ROUTES.members}>Meet the members</Link>
        </Button>
      )}
    </EmptyState>
  );
}
