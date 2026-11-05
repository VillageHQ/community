"use client";

import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

import { clearLinkedinRequest, confirmLinkedinRequest, confirmMemberRequest } from "../../admin/members/invite-queries";

type AdminMemberPanelProps = {
  memberId: string;
  email: string;
  isEmailConfirmed: boolean;
  linkedinUrl: string | null;
  isLinkedinConfirmed: boolean;
};

export function AdminMemberPanel({ memberId, email, isEmailConfirmed, linkedinUrl, isLinkedinConfirmed }: AdminMemberPanelProps) {
  const router = useRouter();
  const confirmMutation = useMutation({ mutationFn: confirmMemberRequest, onSuccess: () => router.refresh() });
  const clearMutation = useMutation({ mutationFn: clearLinkedinRequest, onSuccess: () => router.refresh() });
  const confirmLinkedinMutation = useMutation({ mutationFn: confirmLinkedinRequest, onSuccess: () => router.refresh() });

  return (
    <Card className="grid gap-3 bg-muted shadow-none">
      <CardTitle>Only admins see this</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-small flex items-center gap-2 wrap-anywhere text-foreground-soft">
          <Mail aria-hidden="true" className="size-icon-small shrink-0" />
          {email}
        </p>
        {isEmailConfirmed ? null : <Tag tone="gold">Email not confirmed</Tag>}
        {isLinkedinConfirmed ? <Tag tone="sage">LinkedIn confirmed</Tag> : null}
      </div>
      {linkedinUrl && !isLinkedinConfirmed ? (
        <p className="type-small text-foreground-soft">
          Members appear as a way in when their name here matches their LinkedIn. Confirm only if this profile really is theirs and the names differ.
        </p>
      ) : null}
      <FormError message={confirmMutation.error?.message ?? clearMutation.error?.message ?? confirmLinkedinMutation.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        {isEmailConfirmed ? null : (
          <Button type="button" size="sm" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(memberId)}>
            Yes, this person owns this email
          </Button>
        )}
        {linkedinUrl && !isLinkedinConfirmed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={confirmLinkedinMutation.isPending}
            onClick={() => confirmLinkedinMutation.mutate(memberId)}
          >
            Confirm this LinkedIn
          </Button>
        ) : null}
        {linkedinUrl ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate(linkedinUrl)}
          >
            Clear their LinkedIn
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
