"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/form-error";
import { FormField, TextareaField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import type { MemberProfile } from "@/modules/members/service-profile";
import { MAXIMUM_NAME_LENGTH } from "@/platform/auth/member-name";
import { ONBOARDING_STEPS, PROFILE_LIMITS } from "@/modules/members/contract-profile";
import { parseTagsText, toProfileBody } from "@/modules/members/rules-profile-form";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { toLinkedinUrl } from "@/modules/members/contract-linkedin";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postNetworkRequest } from "@/platform/http/post-request";

import { AvatarField } from "./avatar-field";

function saveCard(formData: FormData) {
  return postNetworkRequest(API_ROUTES.profile, toProfileBody(formData), acknowledgedResponseSchema);
}

function completeCardStep() {
  return postNetworkRequest(API_ROUTES.onboarding, { step: ONBOARDING_STEPS.card }, acknowledgedResponseSchema);
}

async function saveCardAndContinue(formData: FormData) {
  await saveCard(formData);
  await completeCardStep();
}

function goToWelcome() {
  window.location.assign(ROUTES.welcome);
}

function submitFormData(event: FormEvent<HTMLFormElement>, submit: (formData: FormData) => void) {
  event.preventDefault();
  submit(new FormData(event.currentTarget));
}

type CardFieldsProps = { profile: MemberProfile };

function RoleFields({ profile }: CardFieldsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField
        name="title"
        label="Your role"
        autoComplete="organization-title"
        placeholder="Founder & CEO"
        defaultValue={profile.title ?? ""}
        maxLength={PROFILE_LIMITS.title}
      />
      <FormField
        name="company"
        label="Company"
        autoComplete="organization"
        defaultValue={profile.company ?? ""}
        maxLength={PROFILE_LIMITS.company}
      />
    </div>
  );
}

function AboutFields({ profile }: CardFieldsProps) {
  return (
    <>
      <TextareaField
        name="bio"
        label="A line about you"
        rows={2}
        placeholder="What are you building, and why?"
        defaultValue={profile.bio ?? ""}
        maxLength={PROFILE_LIMITS.bio}
      />
      <TextareaField
        name="canHelpWith"
        label="What you can help with"
        rows={2}
        placeholder="Your first sales hire, pricing, grant applications"
        defaultValue={profile.canHelpWith ?? ""}
        maxLength={PROFILE_LIMITS.canHelpWith}
      />
      <TextareaField
        name="needs"
        label="What you need right now"
        rows={2}
        placeholder="An intro to a logistics buyer, a design partner"
        defaultValue={profile.needs ?? ""}
        maxLength={PROFILE_LIMITS.needs}
      />
    </>
  );
}

function LinkedinField({ profile }: CardFieldsProps) {
  return (
    <FormField
      name="linkedinUrl"
      label="LinkedIn profile URL"
      type="url"
      autoComplete="url"
      placeholder="https://www.linkedin.com/in/your-name"
      defaultValue={profile.linkedinSlug ? toLinkedinUrl(profile.linkedinSlug) : ""}
      maxLength={PROFILE_LIMITS.linkedinUrl}
      hint="Members see this on your profile and recognize you by it in their intro paths."
    />
  );
}

function TagsField({ profile }: CardFieldsProps) {
  const [tagsText, setTagsText] = useState(profile.tags.join(", "));
  const tags = parseTagsText(tagsText);
  return (
    <div className="grid gap-2">
      <FormField
        name="tags"
        label="Tags"
        value={tagsText}
        onChange={(event) => setTagsText(event.target.value)}
        placeholder="Fintech, Series A, Hiring"
        hint={`Separate them with commas. Up to ${PROFILE_LIMITS.tags}. Members can search and filter by these.`}
      />
      {tags.length > 0 ? (
        <div aria-hidden="true" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OnboardingCardForm({ profile }: CardFieldsProps) {
  const saveMutation = useMutation({ mutationFn: saveCardAndContinue, onSuccess: goToWelcome });
  const skipMutation = useMutation({ mutationFn: completeCardStep, onSuccess: goToWelcome });
  const isBusy = saveMutation.isPending || skipMutation.isPending;
  return (
    <form onSubmit={(event) => submitFormData(event, saveMutation.mutate)} className="grid gap-5">
      <RoleFields profile={profile} />
      <AboutFields profile={profile} />
      <LinkedinField profile={profile} />
      <FormError message={saveMutation.error?.message ?? skipMutation.error?.message ?? null} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={isBusy} className="max-sm:w-full">
          {saveMutation.isPending ? "Saving…" : "Save and continue"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="lg"
          disabled={isBusy}
          className="max-sm:w-full"
          onClick={() => skipMutation.mutate()}
        >
          Skip for now
        </Button>
      </div>
      <p className="type-small text-muted-foreground">
        You can finish or change your card any time from the menu.
      </p>
    </form>
  );
}

function EditCardForm({ profile }: CardFieldsProps) {
  const router = useRouter();
  const saveMutation = useMutation({
    mutationFn: saveCardAndContinue,
    onSuccess: () => {
      router.push(`${ROUTES.members}/${profile.id}`);
      router.refresh();
    },
  });
  return (
    <form onSubmit={(event) => submitFormData(event, saveMutation.mutate)} className="grid gap-5">
      <FormField
        name="name"
        label="Your name"
        autoComplete="name"
        defaultValue={profile.name}
        maxLength={MAXIMUM_NAME_LENGTH}
        required
      />
      <RoleFields profile={profile} />
      <FormField
        name="location"
        label="Location"
        placeholder="Lisbon"
        defaultValue={profile.location ?? ""}
        maxLength={PROFILE_LIMITS.location}
      />
      <AboutFields profile={profile} />
      <TagsField profile={profile} />
      <LinkedinField profile={profile} />
      <FormField
        name="website"
        label="Website"
        type="url"
        autoComplete="url"
        placeholder="https://example.com"
        defaultValue={profile.website ?? ""}
        maxLength={PROFILE_LIMITS.website}
      />
      <FormError message={saveMutation.error?.message ?? null} />
      <Button type="submit" size="lg" disabled={saveMutation.isPending} className="max-sm:w-full sm:justify-self-start">
        {saveMutation.isPending ? "Saving…" : "Save my card"}
      </Button>
    </form>
  );
}

export function CardForm({ profile, isOnboarding = false }: CardFieldsProps & { isOnboarding?: boolean }) {
  return (
    <div className="grid gap-5">
      <AvatarField memberId={profile.id} name={profile.name} avatarUrl={profile.avatarUrl} />
      {isOnboarding ? <OnboardingCardForm profile={profile} /> : <EditCardForm profile={profile} />}
    </div>
  );
}
