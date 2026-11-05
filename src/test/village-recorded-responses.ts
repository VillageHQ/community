export type ResponseShape = string | readonly ResponseShape[] | { readonly [field: string]: ResponseShape };

const ERROR_FIELDS = { type: "string", title: "string", status: "number", detail: "string", trace_id: "string" };
const ERROR_METADATA = { request_id: "string", timestamp: "string" };
const SUCCESS_METADATA = { request_id: "string" };

const PROFILE = {
  first_name: "string",
  last_name: "string",
  linkedin_url: "string",
  headline: "string",
  avatar: "string",
  title: "string",
  company: "string",
};
const SCORE_META = [{ title: "string", description: "string" }];
const SUMMARY = { score: "number", score_label: "string", description: "string" };

export const VILLAGE_ERROR_SHAPE = { error: ERROR_FIELDS, metadata: ERROR_METADATA };
export const VILLAGE_VALIDATION_ERROR_SHAPE = {
  error: { ...ERROR_FIELDS, errors: [{ field: "string", message: "string", code: "string" }] },
  metadata: ERROR_METADATA,
};

export const VILLAGE_CREDITS_ERROR_SHAPE = {
  error: "string",
  message: "string",
  topup_url: "string",
  credits_left: "number",
};
export const VILLAGE_RATE_LIMIT_ERROR_SHAPE = {
  error: "string",
  message: "string",
  details: { limit: "number", remaining: "number", reset: "number" },
};

export const VILLAGE_TOKEN_SHAPE = {
  data: { token: "string", expires_in: "number", expires_at: "number", token_type: "string" },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_APP_SHAPE = {
  data: {
    title: "string",
    description: "string",
    domain_name: "string",
    logo: "string|null",
    public_key: "string",
    is_active: "boolean",
  },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_USER_SHAPE = {
  data: {
    id: "string",
    email: "string",
    name: "string",
    created_at: "string",
    is_sync_complete: "boolean",
    is_active: "boolean",
  },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_GROUPS_SHAPE = {
  data: { groups: [{ id: "string", name: "string", logo: "string|null", invite_link: "string", is_admin: "boolean" }] },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_CREATED_GROUP_SHAPE = {
  data: { id: "string", name: "string", logo: "string|null", invite_link: "string" },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_GROUP_CHANGE_SHAPE = {
  data: { success: "boolean", message: "string" },
  metadata: SUCCESS_METADATA,
};

export const VILLAGE_SEARCH_SHAPE = {
  data: [
    {
      id: "number",
      first_name: "string",
      last_name: "string",
      full_name: "string",
      linkedin_url: "string",
      headline: "string",
      about_me: "string|null",
      location: "object",
      work_relevant: "object",
      education_relevant: "object|null",
      image_url: "string",
      relationship_cached: "object",
      last_enrichment_at: "string",
    },
  ],
  metadata: {
    request_id: "string",
    mode: "string",
    source: "string",
    network_stage_complete: "boolean",
    generated_sql: "string",
    search_engine: "string",
    screening_criteria: "object",
    counts_token: "string",
    search_execution_token: "string",
  },
  pagination: { cursor: "string", has_next_page: "boolean", count: "number" },
};

export const VILLAGE_PATHS_SHAPE = {
  data: {
    person: {
      first_name: "string",
      last_name: "string",
      full_name: "string",
      linkedin_url: "string",
      avatar: "string",
      village_url: "string",
    },
    summary: SUMMARY,
    count: "number",
    paths: [
      {
        degree: "number",
        summary: SUMMARY,
        starters: [
          {
            profile: PROFILE,
            score: "number",
            score_label: "string",
            score_description: "string",
            score_meta: SCORE_META,
            is_current_user: "boolean",
          },
        ],
        introducer: { profile: PROFILE, score: "number", score_label: "string", score_meta: SCORE_META },
        score_meta: SCORE_META,
      },
    ],
  },
  metadata: { request_id: "string", counts: { total: { value: "number" } } },
};
