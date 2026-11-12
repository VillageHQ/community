// The fields of "In your own words" on My profile, by their Founderhall names (/me?edit=<key>#f-<key>).
export const OWN_FIELD_KEYS = {
  name: "name",
  role: "role",
  company: "company",
  city: "city",
  stage: "stage",
  sector: "sector",
  cohort: "cohort",
  workingOn: "working_on",
  canHelpWith: "can_help_with",
  lookingFor: "looking_for",
  tags: "tags",
  linkedin: "linkedin",
  website: "website",
} as const;

export type OwnFieldKey = (typeof OWN_FIELD_KEYS)[keyof typeof OWN_FIELD_KEYS];
