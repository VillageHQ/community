import { z } from "zod";

// Who may start a conversation with a member. Admins can always write. "default" follows the community's default.
export const MESSAGE_POLICIES = { communityDefault: "default", anyone: "anyone", introduced: "introduced" } as const;
export type MessagePolicy = (typeof MESSAGE_POLICIES)[keyof typeof MESSAGE_POLICIES];

// The community's default: anyone. ("The community's default · Now: anyone in the community.")
export const COMMUNITY_MESSAGE_POLICY = MESSAGE_POLICIES.anyone;

export function readEffectiveMessagePolicy(policy: MessagePolicy) {
  return policy === MESSAGE_POLICIES.communityDefault ? COMMUNITY_MESSAGE_POLICY : policy;
}

// Where a member made a choice, for their consent record.
export const CHOICE_PLACES = { onboarding: "onboarding", yourData: "your_data" } as const;
export type ChoicePlace = (typeof CHOICE_PLACES)[keyof typeof CHOICE_PLACES];

export const CHOICE_PLACE_WORDS: Record<ChoicePlace, string> = {
  [CHOICE_PLACES.onboarding]: "when you joined",
  [CHOICE_PLACES.yourData]: "on Your data",
};

// Every field is optional: the page saves one switch at a time.
export const privacyBodySchema = z
  .object({
    isHidden: z.boolean().optional(),
    messagePolicy: z.enum([MESSAGE_POLICIES.communityDefault, MESSAGE_POLICIES.anyone, MESSAGE_POLICIES.introduced]).optional(),
    acceptsIntroAsks: z.boolean().optional(),
  })
  .strict();
export type PrivacyBody = z.infer<typeof privacyBodySchema>;

export const introAsksAnswerBodySchema = z.object({ acceptsIntroAsks: z.boolean() }).strict();

export const DELETE_CONFIRMATION_WORD = "delete";
export const deleteAccountBodySchema = z.object({ confirmation: z.string().trim().toLowerCase().pipe(z.literal(DELETE_CONFIRMATION_WORD, "Type delete to confirm.")) }).strict();

export const DELETED_MEMBER_NAME = "Deleted member";
export const adminDeleteAccountBodySchema = deleteAccountBodySchema.extend({ memberId: z.string().min(1) });

export const deleteAccountResponseSchema = z.object({ message: z.string(), isVillageIncomplete: z.boolean() });
