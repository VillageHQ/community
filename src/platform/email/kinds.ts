// Every email the app sends. A kind with a topic is optional: it carries unsubscribe headers,
// honours the member's switch for that topic and skips the do-not-send list. A kind without
// one is transactional: the person needs it to get in or back in.
export const EMAIL_TOPICS = { intros: "intros", messages: "messages", network: "network" } as const;

export type EmailTopic = (typeof EMAIL_TOPICS)[keyof typeof EMAIL_TOPICS];

export const EMAIL_KINDS = {
  invite: "invite",
  emailConfirmation: "email_confirmation",
  passwordReset: "password_reset",
  signInLink: "sign_in_link",
  introAsked: "intro_asked",
  introUpdate: "intro_update",
  introDeclined: "intro_declined",
  directMessage: "direct_message",
  creditWarning: "credit_warning",
  connectNudge: "connect_nudge",
} as const;

export type EmailKind = (typeof EMAIL_KINDS)[keyof typeof EMAIL_KINDS];

const TOPIC_BY_KIND: Record<EmailKind, EmailTopic | null> = {
  [EMAIL_KINDS.invite]: null,
  [EMAIL_KINDS.emailConfirmation]: null,
  [EMAIL_KINDS.passwordReset]: null,
  [EMAIL_KINDS.signInLink]: null,
  [EMAIL_KINDS.introAsked]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.introUpdate]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.introDeclined]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.directMessage]: EMAIL_TOPICS.messages,
  [EMAIL_KINDS.creditWarning]: null,
  [EMAIL_KINDS.connectNudge]: EMAIL_TOPICS.network,
};

export const EMAIL_TOPIC_LABELS: Record<EmailTopic, { title: string; description: string }> = {
  [EMAIL_TOPICS.intros]: { title: "Intro asks", description: "When someone asks you for an intro, or answers yours." },
  [EMAIL_TOPICS.messages]: { title: "Direct messages", description: "When someone messages you. At most one email per conversation every 15 minutes." },
  [EMAIL_TOPICS.network]: { title: "Network reminders", description: "An admin's reminder to connect your network. At most one every 30 days." },
};

const TOPIC_VALUES: readonly string[] = Object.values(EMAIL_TOPICS);

export function isEmailTopic(value: string): value is EmailTopic {
  return TOPIC_VALUES.includes(value);
}

export function readEmailTopic(kind: string): EmailTopic | null {
  return Object.entries(TOPIC_BY_KIND).find(([known]) => known === kind)?.[1] ?? null;
}
