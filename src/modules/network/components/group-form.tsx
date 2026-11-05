"use client";

import { Waypoints } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { FormError } from "@/components/form-error";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

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
    window.location.assign(window.location.pathname);
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
  defaultName: string;
};

export function GroupForm({ hasKeys, hasGroup, isVillageReachable, isSynced, defaultName }: GroupFormProps) {
  const [state, formAction, isPending] = useActionState(submitGroup, INITIAL_STATE);

  if (hasGroup) return <p className="text-foreground-soft">The group exists. Members can join from their network page.</p>;
  if (!hasKeys) return <p className="text-foreground-soft">Save your keys first.</p>;
  if (!isVillageReachable) return <FormError message="Village isn't responding. Reload to try again." />;
  if (!isSynced) {
    return (
      <>
        <p className="text-foreground-soft">
          Your Village account must be linked and synced first. That connects your own network, so there&apos;s
          something to share. It happens on the network page.
        </p>
        <div>
          <Button asChild variant="outline">
            <Link href={ROUTES.network}>
              <Waypoints aria-hidden="true" />
              Open your network
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <Alert>The group is what lets members search each other&apos;s networks. Give it your community&apos;s name.</Alert>
      <FormError message={state.errorMessage} />
      <FormField name="name" label="Group name" autoComplete="off" defaultValue={defaultName} required />
      <CheckboxCard id={ACKNOWLEDGE_FIELD} name={ACKNOWLEDGE_FIELD}>
        Creating this group makes my own Village network shared with every current and future member of this
        community.
      </CheckboxCard>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating group…" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
