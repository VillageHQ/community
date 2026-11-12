// Every email the app sends. A kind with a topic is optional: it carries unsubscribe headers,
// honours the member's switch for that topic and skips the do-not-send list. A kind without
// one is transactional: the person needs it to get in or back in.
export const EMAIL_TOPICS = {
  weekly: "weekly",
  intros: "intros",
  // The nudges after an intro ask: the connector's reminder and "was the intro helpful?" again (PRIV-09).
  introReminders: "intro_reminders",
  messages: "messages",
  network: "network",
  asks: "asks",
} as const;

export type EmailTopic = (typeof EMAIL_TOPICS)[keyof typeof EMAIL_TOPICS];

export const EMAIL_KINDS = {
  invite: "invite",
  // To the invited address after a join from its emailed link: "Wasn't you?" (members' service-invite-notice.ts).
  inviteUsed: "invite_used",
  emailConfirmation: "email_confirmation",
  passwordReset: "password_reset",
  signInLink: "sign_in_link",
  introAsked: "intro_asked",
  introUpdate: "intro_update",
  introDeclined: "intro_declined",
  introReminder: "intro_reminder",
  // The first email to the person asked (Founderhall's kind); the timed reminder is introTargetReminder.
  introTargetAsk: "intro_target_ask",
  introTargetReminder: "intro_target_reminder",
  directMessage: "direct_message",
  weeklyEmail: "weekly_email",
  creditWarning: "credit_warning",
  connectNudge: "connect_nudge",
  askHelper: "ask_helper",
  askHelpOffered: "ask_help_offered",
  partnerReport: "partner_report",
  emailTest: "email_test",
  introThread: "intro_thread",
  replyNotice: "reply_notice",
} as const;

export type EmailKind = (typeof EMAIL_KINDS)[keyof typeof EMAIL_KINDS];

const TOPIC_BY_KIND: Record<EmailKind, EmailTopic | null> = {
  [EMAIL_KINDS.invite]: null,
  // The address's only warning that someone else holds its invite, so no switch turns it off.
  [EMAIL_KINDS.inviteUsed]: null,
  [EMAIL_KINDS.emailConfirmation]: null,
  [EMAIL_KINDS.passwordReset]: null,
  [EMAIL_KINDS.signInLink]: null,
  [EMAIL_KINDS.introAsked]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.introUpdate]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.introDeclined]: EMAIL_TOPICS.intros,
  [EMAIL_KINDS.introReminder]: EMAIL_TOPICS.introReminders,
  // To the person asked, who isn't a member and has no switch. Sent once; the page it links to has "stop all asks".
  [EMAIL_KINDS.introTargetAsk]: null,
  [EMAIL_KINDS.introTargetReminder]: null,
  [EMAIL_KINDS.directMessage]: EMAIL_TOPICS.messages,
  [EMAIL_KINDS.weeklyEmail]: EMAIL_TOPICS.weekly,
  [EMAIL_KINDS.creditWarning]: null,
  [EMAIL_KINDS.connectNudge]: EMAIL_TOPICS.network,
  [EMAIL_KINDS.askHelper]: EMAIL_TOPICS.asks,
  // To the asker when a member says "I can help": the answer to their own ask, like an intro update.
  [EMAIL_KINDS.askHelpOffered]: null,
  // Sent by an admin to people outside the community, who have no member switch. The send itself skips addresses that bounced.
  [EMAIL_KINDS.partnerReport]: null,
  // An admin's "Send a test to me" from Settings.
  [EMAIL_KINDS.emailTest]: null,
  // A reply in an intro thread, passed on to the other person. They are mid-conversation, and the outside person has no switch.
  [EMAIL_KINDS.introThread]: null,
  // The one plain answer to an emailed reply: why it didn't land, or the next step after a YES.
  [EMAIL_KINDS.replyNotice]: null,
};

export const EMAIL_TOPIC_LABELS: Record<EmailTopic, { title: string; description: string }> = {
  [EMAIL_TOPICS.weekly]: { title: "Weekly email", description: "One email a week with what needs you. Skipped when there's nothing." },
  [EMAIL_TOPICS.intros]: { title: "Intro asks", description: "When someone asks you for an intro, or answers yours." },
  [EMAIL_TOPICS.introReminders]: { title: "Intro reminders", description: "A reminder about an intro ask you haven't answered, and a second \"was it helpful?\"." },
  [EMAIL_TOPICS.messages]: { title: "Direct messages", description: "When someone messages you. At most one email per conversation every 15 minutes." },
  [EMAIL_TOPICS.network]: { title: "Network reminders", description: "An admin's reminder to connect your network. At most one every 30 days." },
  [EMAIL_TOPICS.asks]: { title: "Asks you could help with", description: "When someone posts an ask you may be able to help with. One email per ask." },
};

const TOPIC_VALUES: readonly string[] = Object.values(EMAIL_TOPICS);

export function isEmailTopic(value: string): value is EmailTopic {
  return TOPIC_VALUES.includes(value);
}

export function readEmailTopic(kind: string): EmailTopic | null {
  return Object.entries(TOPIC_BY_KIND).find(([known]) => known === kind)?.[1] ?? null;
}
