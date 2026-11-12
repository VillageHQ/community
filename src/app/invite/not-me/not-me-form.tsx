"use client";

import { useActionState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { API_ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

type NotMeState = { isDone: boolean; errorMessage: string | null };

const INITIAL_STATE: NotMeState = { isDone: false, errorMessage: null };
const FALLBACK_ERROR_MESSAGE = "That didn't go through. Try again.";
const reportedSchema = z.object({ isReported: z.literal(true) });

export function NotMeForm({ member, signature }: { member: string; signature: string }) {
  const [state, formAction, isPending] = useActionState(async (): Promise<NotMeState> => {
    try {
      await postRequest(API_ROUTES.inviteNotMe, { member, signature }, reportedSchema, FALLBACK_ERROR_MESSAGE);
      return { isDone: true, errorMessage: null };
    } catch (error) {
      return { isDone: false, errorMessage: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE };
    }
  }, INITIAL_STATE);

  if (state.isDone) {
    return (
      <Note kind="ok" role="status" className="mt-[18px]">
        Done. That person is signed out, and your admins can see that the invite wasn’t used by you. They’ll send you a new one.
      </Note>
    );
  }
  return (
    <form action={formAction} className="mt-[18px]">
      {state.errorMessage ? (
        <Note kind="needs" role="alert" className="mb-3">
          {state.errorMessage}
        </Note>
      ) : null}
      <Button type="submit" width="block" disabled={isPending}>
        {isPending ? "Signing them out…" : "It wasn’t me"}
      </Button>
    </form>
  );
}
