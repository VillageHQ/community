"use client";

import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

import { clearLinkedinRequest, confirmMemberRequest } from "../../admin/members/invite-queries";

type AdminMemberPanelProps = {
  memberId: string;
  email: string;
  isEmailConfirmed: boolean;
  linkedinUrl: string | null;
};

export function AdminMemberPanel({ memberId, email, isEmailConfirmed, linkedinUrl }: AdminMemberPanelProps) {
  const router = useRouter();
  const confirmMutation = useMutation({ mutationFn: confirmMemberRequest, onSuccess: () => router.refresh() });
  const clearMutation = useMutation({ mutationFn: clearLinkedinRequest, onSuccess: () => router.refresh() });

  return (
    <Card className="grid gap-3 bg-muted shadow-none">
      <CardTitle>Only admins see this</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-small flex items-center gap-2 wrap-anywhere text-foreground-soft">
          <Mail aria-hidden="true" className="size-icon-small shrink-0" />
          {email}
        </p>
        {isEmailConfirmed ? null : <Tag tone="gold">Email not confirmed</Tag>}
      </div>
      <FormError message={confirmMutation.error?.message ?? clearMutation.error?.message ?? null} />
      <div className="flex flex-wrap gap-2">
        {isEmailConfirmed ? null : (
          <Button type="button" size="sm" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate(memberId)}>
            Yes, this person owns this email
          </Button>
        )}
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
