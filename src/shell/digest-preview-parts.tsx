"use client";

import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";

const testSchema = z.object({ outcome: z.string(), message: z.string() });

// The member picker: choosing one shows their digest.
export function DigestMemberPicker({ members, selected }: { members: readonly { id: string; label: string }[]; selected: string }) {
  const router = useRouter();
  return (
    <form method="get" action={ROUTES.adminDigest} className="fh-btn-row">
      <label className="sr-only" htmlFor="dg-m">
        Member
      </label>
      <Select
        id="dg-m"
        name="member"
        value={selected}
        className="flex-[1_1_220px]"
        onChange={(event) => router.push(`${ROUTES.adminDigest}?member=${encodeURIComponent(event.target.value)}`)}
      >
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.label}
          </option>
        ))}
      </Select>
    </form>
  );
}

// Send me a test digest: to the admin's own address, with their own items; the page lands with the flash.
export function DigestTestButton() {
  const router = useRouter();
  const send = useMutation({
    mutationFn: () => postRequest(API_ROUTES.adminWeeklyEmailTest, {}, testSchema),
    onSuccess: ({ outcome }) => {
      router.replace(`${ROUTES.adminDigest}?m=${outcome === "sent" || outcome === "queued" ? "digesttest" : outcome}`, { scroll: false });
      router.refresh();
    },
  });
  return (
    <div className="mt-3">
      <Button type="button" size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
        <Send aria-hidden="true" />
        Send me a test digest
      </Button>
      <FormError message={send.error?.message ?? null} />
    </div>
  );
}
