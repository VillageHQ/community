import "server-only";

import { eq } from "drizzle-orm";

import { asksManifest } from "@/modules/asks/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { memberNetwork } from "@/modules/members/schema";
import { messagesManifest } from "@/modules/messages/manifest";
import { networkManifest } from "@/modules/network/manifest";
import type { Database } from "@/platform/database/client";
import { EMAIL_TOPICS } from "@/platform/email/kinds";
import { readResendConfig } from "@/platform/email/resend";
import { readOptedOutTopics } from "@/platform/email/unsubscribe";
import { WEEKDAYS } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { readEnabledIds } from "@/shell/enabled-modules";

import type { EmailSettingRow } from "./email-preferences-card";

// The rows of Founderhall's Email settings: the weekly digest, asks and messages. Community's own: intro emails and
// intro reminders, each with its own switch like the others (PRIV-09), and the reminder to connect a network only for
// a member who hasn't connected one.
export async function readEmailSettingRows(database: Database, memberId: string): Promise<EmailSettingRow[] | null> {
  if (!readResendConfig(process.env)) return null;
  const [enabledIds, optedOut, schedule, [network]] = await Promise.all([
    readEnabledIds(database),
    readOptedOutTopics(database, memberId),
    readWeeklySchedule(database),
    database.select({ villageLinkedAt: memberNetwork.villageLinkedAt }).from(memberNetwork).where(eq(memberNetwork.userId, memberId)),
  ]);
  const isOn = (topic: string) => !optedOut.has(topic);
  const hour = String(schedule.hour).padStart(2, "0");
  const rows: EmailSettingRow[] = [
    {
      topic: EMAIL_TOPICS.weekly,
      title: "The weekly digest",
      description: `Every ${WEEKDAYS[schedule.weekday]} at ${hour}:00 (${schedule.timeZone}): asks you could help with, intros waiting for your yes, lines on your profile to check. Answer from your inbox. Not sent when there’s nothing to answer.`,
      isOn: isOn(EMAIL_TOPICS.weekly),
    },
  ];
  if (enabledIds.has(asksManifest.id)) {
    rows.push({
      topic: EMAIL_TOPICS.asks,
      title: "Email me when an ask needs someone I know",
      description: "At most one email per ask, the moment it’s posted. Reply to answer under the ask.",
      isOn: isOn(EMAIL_TOPICS.asks),
    });
  }
  if (enabledIds.has(messagesManifest.id)) {
    rows.push({
      topic: EMAIL_TOPICS.messages,
      title: "Email me when someone messages me",
      description: "At most one email per conversation every 15 minutes. Reply to it to answer.",
      isOn: isOn(EMAIL_TOPICS.messages),
    });
  }
  if (enabledIds.has(introsManifest.id)) {
    rows.push(
      {
        topic: EMAIL_TOPICS.intros,
        title: "Email me about intro asks and introductions",
        description: "When a member asks you for an intro, and each step of one you asked for. Off, you’ll still find them on Intros.",
        isOn: isOn(EMAIL_TOPICS.intros),
      },
      {
        topic: EMAIL_TOPICS.introReminders,
        title: "Remind me about intros",
        description: "One reminder when an intro ask waits for your answer, and one more “was it helpful?”.",
        isOn: isOn(EMAIL_TOPICS.introReminders),
      },
    );
  }
  if (enabledIds.has(networkManifest.id) && !network?.villageLinkedAt) {
    rows.push({
      topic: EMAIL_TOPICS.network,
      title: "Remind me to connect my network",
      description: "An admin’s reminder, at most one every 30 days.",
      isOn: isOn(EMAIL_TOPICS.network),
    });
  }
  return rows;
}
