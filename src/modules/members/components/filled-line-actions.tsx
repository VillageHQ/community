"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useFlash } from "@/components/flash";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { FILL_IN_FIELD_LABELS, FILL_IN_FIELDS, type FillInField } from "@/modules/members/contract-fill-in";

// Where "Correct" opens the member's own words for that line.
const OWN_FIELD_OF: Partial<Record<FillInField, string>> = { [FILL_IN_FIELDS.title]: "role", [FILL_IN_FIELDS.company]: "company", [FILL_IN_FIELDS.location]: "city" };

function setLineHidden({ field, isHidden }: { field: FillInField; isHidden: boolean }) {
  return postRequest(API_ROUTES.profileFillIn, { field, isHidden }, acknowledgedResponseSchema);
}

function useLineVisibility() {
  const router = useRouter();
  const flash = useFlash();
  return useMutation({
    mutationFn: setLineHidden,
    onSuccess: () => {
      flash("Saved. Hidden lines stay hidden when your profile refreshes.");
      router.refresh();
    },
  });
}

// My profile: Correct (opens the own-words field) and Hide or Show, under one filled-in line.
export function FilledLineActions({ field, isHidden }: { field: FillInField; isHidden: boolean }) {
  const visibility = useLineVisibility();
  const ownField = OWN_FIELD_OF[field] ?? "";
  return (
    <span className="fh-acts">
      <Button asChild variant="quiet" size="sm">
        <Link href={`${ROUTES.editCard}?edit=${ownField}#f-${ownField}`}>Correct</Link>
      </Button>
      <Button
        type="button"
        variant="quiet"
        size="sm"
        disabled={visibility.isPending}
        aria-label={`${isHidden ? "Show" : "Hide"} the ${FILL_IN_FIELD_LABELS[field].toLowerCase()} from public profiles`}
        onClick={() => visibility.mutate({ field, isHidden: !isHidden })}
      >
        {isHidden ? "Show" : "Hide"}
      </Button>
      <FormError message={visibility.error?.message ?? null} />
    </span>
  );
}

// "Hide my past roles": the past roles hide and show as one line.
export function PastRolesToggle({ isHidden }: { isHidden: boolean }) {
  const visibility = useLineVisibility();
  return (
    <div className="mt-2">
      <Button type="button" variant="quiet" size="sm" disabled={visibility.isPending} onClick={() => visibility.mutate({ field: FILL_IN_FIELDS.pastRoles, isHidden: !isHidden })}>
        {isHidden ? "Show my past roles" : "Hide my past roles"}
      </Button>
      <FormError message={visibility.error?.message ?? null} />
    </div>
  );
}
