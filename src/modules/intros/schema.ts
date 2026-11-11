import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { CONSENT_ANSWERS, INTRO_DECLINE_KINDS, INTRO_LIMITS, INTRO_OUTCOMES, INTRO_RESULTS, INTRO_STATES, OPEN_INTRO_STATES } from "./contract.ts";
import { user } from "../../platform/database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function toSqlLiterals(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

function toSqlNumber(value: number) {
  return sql.raw(String(value));
}

function introTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

export const introRequest = pgTable(
  "intro_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    introducerId: text("introducer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetLinkedinSlug: text("target_linkedin_slug").notNull(),
    targetName: text("target_name").notNull(),
    targetHeadline: text("target_headline"),
    introducerName: text("introducer_name").notNull(),
    introducerHeadline: text("introducer_headline"),
    // Empty when the connector has no LinkedIn address on file (an ask from a profile, with no Village).
    introducerLinkedinSlug: text("introducer_linkedin_slug"),
    reason: text("reason").notNull(),
    note: text("note").notNull(),
    state: text("state").notNull().default(INTRO_STATES.requested),
    declineReason: text("decline_reason"),
    declineKind: text("decline_kind"),
    isWithheld: boolean("is_withheld").notNull().default(false),
    requesterHasUpdate: boolean("requester_has_update").notNull().default(false),
    askedEmailAt: introTimestamp("asked_email_at"),
    createdAt: introTimestamp("created_at").notNull().defaultNow(),
    acceptedAt: introTimestamp("accepted_at"),
    closedAt: introTimestamp("closed_at"),
    expiresAt: introTimestamp("expires_at").notNull(),
    targetEmail: text("target_email"),
    consentEmailAt: introTimestamp("consent_email_at"),
    askedTargetAt: introTimestamp("asked_target_at"),
    targetAgreedAt: introTimestamp("target_agreed_at"),
    outcome: text("outcome"),
    outcomeAnsweredAt: introTimestamp("outcome_answered_at"),
    outcomeResults: text("outcome_results").array(),
    outcomeEmailAt: introTimestamp("outcome_email_at"),
    outcomeReminderAt: introTimestamp("outcome_reminder_at"),
    // When the one reminder to the person asked was claimed. Set once, so it never goes twice.
    targetReminderAt: introTimestamp("target_reminder_at"),
    // When the one reminder to a connector who hadn't answered was claimed. Set once, so it never goes twice.
    connectorReminderAt: introTimestamp("connector_reminder_at"),
    // When the one "closed without an answer" email to the asker was claimed. Set once, so it never goes twice.
    expiryEmailAt: introTimestamp("expiry_email_at"),
    // What the person asked answered on this intro (yes, no thanks, stop all), so a later stop-all on another intro
    // never rewrites what this link shows. Null before they answered, and on rows from before this column.
    targetAnswer: text("target_answer"),
    // The ask this intro came from, if any. No foreign key: asks is another module, and an intro outlives its ask.
    askId: uuid("ask_id"),
    // The connector offered it ("I know someone") instead of being asked. It counts toward no allowance or cap.
    isConnectorOffer: boolean("is_connector_offer").notNull().default(false),
    // The asker named the person (from a profile), so there is no Village path and neither member needs the network.
    // `targetLinkedinSlug` then holds their LinkedIn slug if the asker gave one, or a key made from name and company.
    isNamedTarget: boolean("is_named_target").notNull().default(false),
    // The address the asker typed for the person, shown only to the connector to fill in the consent email. Open asks only.
    suggestedTargetEmail: text("suggested_target_email"),
  },
  (table) => [
    uniqueIndex("intro_request_open_unique")
      .on(table.requesterId, table.introducerId, table.targetLinkedinSlug)
      .where(sql`${table.state} in (${toSqlLiterals(OPEN_INTRO_STATES)})`),
    index("intro_request_requester_created_idx").on(table.requesterId, table.createdAt),
    index("intro_request_introducer_created_idx").on(table.introducerId, table.createdAt),
    index("intro_request_ask_id_idx").on(table.askId).where(sql`${table.askId} is not null`),
    check("intro_request_state_known", sql`${table.state} in (${toSqlLiterals(Object.values(INTRO_STATES))})`),
    check("intro_request_not_self", sql`${table.requesterId} <> ${table.introducerId}`),
    check("intro_request_note_length", sql`char_length(${table.note}) between 1 and ${toSqlNumber(INTRO_LIMITS.noteLength)}`),
    check(
      "intro_request_decline_reason",
      sql`${table.declineReason} is null or (${table.state} = '${sql.raw(INTRO_STATES.declined)}' and char_length(${table.declineReason}) between 1 and ${toSqlNumber(INTRO_LIMITS.declineReasonLength)})`,
    ),
    check(
      "intro_request_decline_kind",
      sql`${table.declineKind} is null or (${table.state} = '${sql.raw(INTRO_STATES.declined)}' and ${table.declineKind} in (${toSqlLiterals(Object.values(INTRO_DECLINE_KINDS))}))`,
    ),
    check(
      "intro_request_target_email_while_open",
      sql`${table.targetEmail} is null or ${table.state} in (${toSqlLiterals([INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed])})`,
    ),
    check(
      "intro_request_suggested_email_while_open",
      sql`${table.suggestedTargetEmail} is null or ${table.state} in (${toSqlLiterals(OPEN_INTRO_STATES)})`,
    ),
    check("intro_request_target_answer_known", sql`${table.targetAnswer} is null or ${table.targetAnswer} in (${toSqlLiterals(Object.values(CONSENT_ANSWERS))})`),
    check(
      "intro_request_outcome_known",
      sql`${table.outcome} is null or (${table.state} = '${sql.raw(INTRO_STATES.completed)}' and ${table.outcome} in (${toSqlLiterals(Object.values(INTRO_OUTCOMES))}))`,
    ),
    check(
      "intro_request_outcome_results",
      sql`${table.outcomeResults} is null or (${table.outcome} = '${sql.raw(INTRO_OUTCOMES.helped)}' and ${table.outcomeResults} <@ array[${toSqlLiterals(Object.values(INTRO_RESULTS))}]::text[])`,
    ),
    check(
      "intro_request_snapshot_lengths",
      sql`char_length(${table.targetName}) between 1 and ${toSqlNumber(INTRO_LIMITS.nameLength)} and char_length(${table.introducerName}) between 1 and ${toSqlNumber(INTRO_LIMITS.nameLength)} and char_length(${table.reason}) between 1 and ${toSqlNumber(INTRO_LIMITS.reasonLength)}`,
    ),
  ],
);

export const introOptOut = pgTable("intro_opt_out", {
  targetSlugHash: text("target_slug_hash").primaryKey(),
  createdAt: introTimestamp("created_at").notNull().defaultNow(),
});

// Every link the connector made for one intro. A link stays valid while the intro waits on the target, so a newer
// link never silently kills one already forwarded. Rows stay after the answer, so a second tap shows that answer.
export const introConsentLink = pgTable(
  "intro_consent_link",
  {
    tokenHash: text("token_hash").primaryKey(),
    introId: uuid("intro_id")
      .notNull()
      .references(() => introRequest.id, { onDelete: "cascade" }),
    createdAt: introTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("intro_consent_link_intro_idx").on(table.introId)],
);
