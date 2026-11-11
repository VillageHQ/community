"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { z } from "zod";

import { Field } from "@/components/form-field";
import { Button, ButtonRow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_LIMITS } from "@/modules/members/contract-profile";
import { MAXIMUM_NAME_LENGTH } from "@/platform/auth/member-name";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { postRequest } from "@/platform/http/post-request";

const FALLBACK_ERROR_MESSAGE = "We couldn't save that. Try again.";

export type AboutValues = { name: string; workingOn: string; canHelpWith: string; role: string; company: string; city: string };

type AboutState = { errorMessage: string | null; values: AboutValues };

function readValues(formData: FormData): AboutValues {
  const read = (key: keyof AboutValues) => String(formData.get(key) ?? "");
  return { name: read("name"), workingOn: read("workingOn"), canHelpWith: read("canHelpWith"), role: read("role"), company: read("company"), city: read("city") };
}

// Founderhall's step 1 form: the name, the two questions, then "A few details (optional)" in pairs, and Next.
export function AboutForm({ initialValues }: { initialValues: AboutValues }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_previous: AboutState, formData: FormData): Promise<AboutState> => {
      const values = readValues(formData);
      try {
        await postRequest(API_ROUTES.onboardingWelcome, values, z.object({ message: z.string() }), FALLBACK_ERROR_MESSAGE);
        router.push(ROUTES.welcomePrivacy);
        // The new name shows in the menu at once.
        router.refresh();
        return { errorMessage: null, values };
      } catch (error) {
        // Founderhall answers with the page again, from the top, so the note above the fields is seen.
        window.scrollTo({ top: 0 });
        return { errorMessage: error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE, values };
      }
    },
    { errorMessage: null, values: initialValues },
  );
  const { values } = state;

  return (
    <form action={formAction} className="fh-section" noValidate>
      {state.errorMessage ? (
        <Note kind="needs" icon={null} role="alert" className="mb-3">
          {state.errorMessage}
        </Note>
      ) : null}
      <Field htmlFor="w-name" label="Your name">
        <Input id="w-name" name="name" autoComplete="name" maxLength={MAXIMUM_NAME_LENGTH} defaultValue={values.name} key={`name-${values.name}`} />
      </Field>
      <Field htmlFor="w1" label="What are you working on?" className="fh-field">
        <Textarea
          id="w1"
          name="workingOn"
          maxLength={PROFILE_LIMITS.bio}
          className="min-h-24"
          placeholder="e.g. a claims tool for mid-size insurers; hiring our first sales lead"
          defaultValue={values.workingOn}
          key={`working-${values.workingOn}`}
        />
      </Field>
      <Field htmlFor="w2" label="Who could you help with?" className="fh-field">
        <Textarea
          id="w2"
          name="canHelpWith"
          maxLength={PROFILE_LIMITS.canHelpWith}
          className="min-h-[84px]"
          placeholder="e.g. founders pricing a B2B product; intros to hospital buyers"
          defaultValue={values.canHelpWith}
          key={`help-${values.canHelpWith}`}
        />
      </Field>
      <p className="fh-label mt-[22px]">
        A few details <span className="fh-muted font-normal">(optional)</span>
      </p>
      <div className="fh-pair">
        <Field htmlFor="w-role" label="Role">
          <Input id="w-role" name="role" maxLength={PROFILE_LIMITS.title} defaultValue={values.role} key={`role-${values.role}`} />
        </Field>
        <Field htmlFor="w-company" label="Company">
          <Input id="w-company" name="company" maxLength={PROFILE_LIMITS.company} defaultValue={values.company} key={`company-${values.company}`} />
        </Field>
        <Field htmlFor="w-city" label="City">
          <Input id="w-city" name="city" maxLength={PROFILE_LIMITS.location} defaultValue={values.city} key={`city-${values.city}`} />
        </Field>
      </div>
      <ButtonRow className="mt-[18px]">
        <Button type="submit" disabled={isPending}>
          Next
        </Button>
      </ButtonRow>
    </form>
  );
}
