import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EMAIL_KINDS, EMAIL_TOPICS, readEmailTopic } from "@/platform/email/kinds";
import { setEmailTopic } from "@/platform/email/unsubscribe";
import { clearDatabase, createTestDatabase } from "@/test/database";
import { FAKE_RESEND_API_KEY } from "@/test/fake-resend-server";
import { createSignedInMember } from "@/test/signed-in-member";

import { readEmailSettingRows } from "./email-settings";

// PRIV-09: intro asks and the reminders after them had no switch on Email settings, unlike the other emails.
describe("Email settings' intro switches", () => {
  const database = createTestDatabase();

  beforeAll(() => {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_API_KEY);
    vi.stubEnv("RESEND_FROM_ADDRESS", "Northwind <hello@example.test>");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await clearDatabase(database);
  });

  it("shows a switch for intro emails and one for intro reminders, both on", async () => {
    const member = await createSignedInMember(database);

    const rows = await readEmailSettingRows(database, member.userId);

    expect(rows?.filter(({ topic }) => topic === EMAIL_TOPICS.intros || topic === EMAIL_TOPICS.introReminders).map(({ topic, isOn }) => [topic, isOn])).toEqual([
      [EMAIL_TOPICS.intros, true],
      [EMAIL_TOPICS.introReminders, true],
    ]);
  });

  it("shows the reminders switched off once the member turns them off", async () => {
    const member = await createSignedInMember(database);
    await setEmailTopic(database, { memberId: member.userId, topic: EMAIL_TOPICS.introReminders }, false);

    const rows = await readEmailSettingRows(database, member.userId);

    expect(rows?.find(({ topic }) => topic === EMAIL_TOPICS.introReminders)?.isOn).toBe(false);
  });

  it("files the reminder emails under the reminders switch", () => {
    expect(readEmailTopic(EMAIL_KINDS.introReminder)).toBe(EMAIL_TOPICS.introReminders);
  });
});
