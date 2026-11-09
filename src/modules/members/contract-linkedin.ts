import { linkedinSlug } from "@villagehq/sdk";

export const MEMBER_ERROR_CODES = {
  linkedinInvalid: "linkedin_invalid",
  linkedinTaken: "linkedin_taken",
} as const;

const CONTROL_CHARACTERS = /\p{Cc}/u;

export function readLinkedinSlug(linkedinUrl: string | null | undefined) {
  const slug = linkedinSlug(linkedinUrl)?.trim();
  if (!slug || CONTROL_CHARACTERS.test(slug)) return null;
  return slug;
}
