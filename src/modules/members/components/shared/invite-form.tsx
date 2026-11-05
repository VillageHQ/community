"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useRef, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { IssuedInvite } from "@/modules/members/contract-invites";

import { createInviteRequest, INVITE_QUERY_KEYS } from "@/modules/members/queries-invites";
import { IssuedLink } from "./issued-link";

const EMAIL_FIELD = "email";
const EMAIL_CONFIGURED_HINT = "We'll email them the link, and you get a copy to share yourself.";
const EMAIL_NOT_CONFIGURED_HINT = "You'll get a personal link to copy and send them yourself.";

function readSubmittedEmail(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return String(new FormData(event.currentTarget).get(EMAIL_FIELD));
}

type InviteFormProps = {
  isEmailConfigured: boolean;
  issued: IssuedInvite | null;
  onIssued: (issued: IssuedInvite) => void;
};

export function InviteForm({ isEmailConfigured, issued, onIssued }: InviteFormProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const createMutation = useMutation({
    mutationFn: createInviteRequest,
    onSuccess: (createdInvite) => {
      formRef.current?.reset();
      onIssued(createdInvite);
      return queryClient.invalidateQueries({ queryKey: [INVITE_QUERY_KEYS.list] });
    },
  });

  return (
    <div className="grid gap-4">
      <form
        ref={formRef}
        onSubmit={(event) => createMutation.mutate(readSubmittedEmail(event))}
        className="grid gap-4"
      >
        <FormError message={createMutation.error?.message ?? null} />
        <FormField
          name={EMAIL_FIELD}
          label="Their email"
          type="email"
          autoComplete="off"
          placeholder="amara@example.com"
          hint={isEmailConfigured ? EMAIL_CONFIGURED_HINT : EMAIL_NOT_CONFIGURED_HINT}
          required
        />
        <Button type="submit" size="lg" disabled={createMutation.isPending} className="max-sm:w-full sm:justify-self-start">
          <Send aria-hidden="true" />
          {createMutation.isPending ? "Creating…" : isEmailConfigured ? "Send invite" : "Create invite"}
        </Button>
      </form>
      {issued ? <IssuedLink issued={issued} /> : null}
    </div>
  );
}
