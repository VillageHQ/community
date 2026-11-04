"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { API_ROUTES, ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

type GroupState = { errorMessage: string | null };

const INITIAL_STATE: GroupState = { errorMessage: null };
const ACKNOWLEDGE_FIELD = "acknowledged";

async function submitGroup(_previousState: GroupState, formData: FormData): Promise<GroupState> {
  try {
    await postNetworkRequest(
      API_ROUTES.villageGroup,
      { name: formData.get("name"), acknowledged: formData.get(ACKNOWLEDGE_FIELD) === "on" },
      acknowledgedResponseSchema,
    );
    window.location.reload();
    return INITIAL_STATE;
  } catch (error) {
    return { errorMessage: error instanceof Error ? error.message : "That failed. Try again." };
  }
}

type GroupFormProps = {
  hasKeys: boolean;
  hasGroup: boolean;
  isVillageReachable: boolean;
  isSynced: boolean;
};

export function GroupForm({ hasKeys, hasGroup, isVillageReachable, isSynced }: GroupFormProps) {
  const [state, formAction, isPending] = useActionState(submitGroup, INITIAL_STATE);

  if (hasGroup) return <p>The group exists. Members can join from their network page.</p>;
  if (!hasKeys) return <p>Save your keys first.</p>;
  if (!isVillageReachable) return <FormError message="Village isn't responding. Reload to try again." />;
  if (!isSynced) {
    return (
      <p>
        Your Village account must be linked and synced first.{" "}
        <Link className="underline" href={ROUTES.network}>
          Open your network
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <FormError message={state.errorMessage} />
      <FormField name="name" label="Group name" autoComplete="off" required />
      <label htmlFor={ACKNOWLEDGE_FIELD} className="flex items-start gap-2">
        <input id={ACKNOWLEDGE_FIELD} name={ACKNOWLEDGE_FIELD} type="checkbox" required className="mt-1" />
        Creating this group makes my own Village network shared with every current and future member
        of this community.
      </label>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating group…" : "Create group"}
      </Button>
    </form>
  );
}
