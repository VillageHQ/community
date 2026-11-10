import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postDisconnect } from "@/app/api/admin/chat/disconnect/route";
import { POST as postDiscordConnect } from "@/app/api/admin/chat/discord/connect/route";
import { POST as postPause } from "@/app/api/admin/chat/pause/route";
import { POST as postSlackChannel } from "@/app/api/admin/chat/slack/channel/route";
import { POST as postSlackConnect } from "@/app/api/admin/chat/slack/connect/route";
import { POST as postTest } from "@/app/api/admin/chat/test/route";
import { POST as postSlackCommand } from "@/app/api/chat/slack/command/route";
import { ASK_ALLOWANCE_SETTING, ASK_CATEGORIES } from "@/modules/asks/contract";
import { ask } from "@/modules/asks/schema";
import { memberBlock } from "@/modules/members/schema";
import { chatManifest } from "@/modules/chat/manifest";
import { chatConnection, chatPost } from "@/modules/chat/schema";
import { composeAskPost, isSlackSignatureValid, signSlackBody } from "@/modules/chat/rules";
import { user } from "@/platform/database/auth-schema";
import { jobLease } from "@/platform/jobs/schema";
import { saveModuleState } from "@/platform/modules/enablement";
import { saveSettings } from "@/platform/settings/store";
import { readCurrentWeek } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { runChatPosts, WEEKLY_EMAIL_JOB_NAME } from "@/shell/chat-posts";
import { clearDatabase, createTestDatabase } from "@/test/database";
import {
  FAKE_DISCORD_CHANNEL,
  FAKE_DISCORD_TOKEN,
  FAKE_SLACK_SIGNING_SECRET,
  FAKE_SLACK_TEAM,
  FAKE_SLACK_TOKEN,
  signSlackRequest,
  startFakeChatServer,
  type FakeChatServer,
} from "@/test/fake-chat-server";
import { createSignedInMember } from "@/test/signed-in-member";
import { answerSlackCommand, SLACK_POSTING_NOTE } from "@/shell/slack-ask";

const APP_URL = "http://localhost:3000";
const SETUP_TOKEN = "chat-test-setup-token-4c7Qz9Lw2Xv8Rb1Np6Ks3Dm5";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const UNPROCESSABLE_STATUS = 422;
const SLACK_CHANNEL = "C0ASKS";
const MINUTE_MS = 60_000;

type Member = Awaited<ReturnType<typeof createSignedInMember>>;
type Handler = (request: Request) => Promise<Response>;

function call(handler: Handler, member: Member, body: unknown) {
  return handler(
    new Request(`${APP_URL}/api/admin/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, cookie: member.cookie },
      body: JSON.stringify(body),
    }),
  );
}

function slashCommand(fields: Record<string, string>, headers: Record<string, string>) {
  const body = new URLSearchParams({ command: "/ask", team_id: FAKE_SLACK_TEAM.id, response_url: "", ...fields }).toString();
  return postSlackCommand(
    new Request(`${APP_URL}/api/chat/slack/command`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body }),
  );
}

function signedSlashCommand(fields: Record<string, string>, timestamp?: number) {
  const body = new URLSearchParams({ command: "/ask", team_id: FAKE_SLACK_TEAM.id, response_url: "", ...fields }).toString();
  return slashCommand(fields, signSlackRequest(FAKE_SLACK_SIGNING_SECRET, body, timestamp));
}

describe("Slack and Discord", () => {
  const database = createTestDatabase();
  let fake: FakeChatServer;
  let admin: Member;

  beforeAll(async () => {
    fake = await startFakeChatServer();
  });

  beforeEach(async () => {
    await clearDatabase(database);
    fake.reset();
    vi.stubEnv("SLACK_API_BASE", fake.environment.SLACK_API_BASE);
    vi.stubEnv("DISCORD_API_BASE", fake.environment.DISCORD_API_BASE);
    vi.stubEnv("SLACK_RESPONSE_BASE", fake.environment.SLACK_RESPONSE_BASE);
    vi.stubEnv("SETUP_TOKEN", SETUP_TOKEN);
    await saveModuleState(database, chatManifest, true);
    admin = await createSignedInMember(database, "admin");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await fake.close();
    await database.$client.end();
  });

  async function connectSlack() {
    expect((await call(postSlackConnect, admin, { token: FAKE_SLACK_TOKEN, signingSecret: FAKE_SLACK_SIGNING_SECRET })).status).toBe(OK_STATUS);
    expect((await call(postSlackChannel, admin, { channelId: SLACK_CHANNEL })).status).toBe(OK_STATUS);
  }

  async function connectDiscord() {
    expect((await call(postDiscordConnect, admin, { token: FAKE_DISCORD_TOKEN, channelId: FAKE_DISCORD_CHANNEL })).status).toBe(OK_STATUS);
  }

  async function postAsk(authorId: string, title: string) {
    const [created] = await database.insert(ask).values({ authorId, title, category: ASK_CATEGORIES.intro }).returning({ id: ask.id });
    return created?.id ?? "";
  }

  describe("connecting", () => {
    it("connects Slack, seals both secrets, picks a channel and sends a test post", async () => {
      await connectSlack();
      const response = await call(postTest, admin, { kind: "slack" });

      expect(response.status).toBe(OK_STATUS);
      expect(fake.posts).toEqual([{ kind: "slack", channel: "#founder-asks", text: expect.stringContaining("test post") }]);
      const [row] = await database.select().from(chatConnection).where(eq(chatConnection.kind, "slack"));
      expect(row?.token.startsWith("sealed.")).toBe(true);
      expect(row?.signingSecret?.startsWith("sealed.")).toBe(true);
      expect(JSON.stringify(row)).not.toContain(FAKE_SLACK_TOKEN);
      expect(row?.accountName).toBe(FAKE_SLACK_TEAM.name);
    });

    it("refuses a token Slack refuses, in plain words, and saves nothing", async () => {
      const response = await call(postSlackConnect, admin, { token: "xoxb-not-the-right-one", signingSecret: FAKE_SLACK_SIGNING_SECRET });

      expect(response.status).toBe(UNPROCESSABLE_STATUS);
      expect((await response.json()).message).toContain("Slack refused the bot token");
      expect(await database.select().from(chatConnection)).toEqual([]);
    });

    it("refuses a channel that isn't in the workspace's list", async () => {
      await call(postSlackConnect, admin, { token: FAKE_SLACK_TOKEN, signingSecret: FAKE_SLACK_SIGNING_SECRET });

      expect((await call(postSlackChannel, admin, { channelId: "C0NOPE" })).status).toBe(UNPROCESSABLE_STATUS);
    });

    it("connects Discord by REST and sends a test post", async () => {
      await connectDiscord();

      expect((await call(postTest, admin, { kind: "discord" })).status).toBe(OK_STATUS);
      expect(fake.posts).toEqual([{ kind: "discord", channel: "#asks", text: expect.stringContaining("test post") }]);
    });

    it("keeps admin routes for admins only", async () => {
      const member = await createSignedInMember(database);

      expect((await call(postSlackConnect, member, { token: FAKE_SLACK_TOKEN, signingSecret: FAKE_SLACK_SIGNING_SECRET })).status).toBe(403);
    });

    it("deletes the token on disconnect", async () => {
      await connectSlack();
      expect((await call(postDisconnect, admin, { kind: "slack" })).status).toBe(OK_STATUS);

      expect(await database.select().from(chatConnection)).toEqual([]);
    });
  });

  describe("posting asks", () => {
    it("posts a new ask exactly once per channel, even after a forced 429", async () => {
      await connectSlack();
      await connectDiscord();
      const author = await createSignedInMember(database);
      await database.update(user).set({ name: "Priya Shah" }).where(eq(user.id, author.userId));
      fake.limit("slack", 1);
      fake.limit("discord", 1);
      await postAsk(author.userId, "An intro to a head of procurement at a US hospital group");

      await runChatPosts(database, process.env);
      await runChatPosts(database, process.env);

      expect(fake.posts.map(({ kind }) => kind).toSorted()).toEqual(["discord", "slack"]);
      expect(fake.posts.every(({ text }) => text.includes("new ask from Priya:"))).toBe(true);
      expect(fake.posts.some(({ text }) => text.includes("Priya Shah"))).toBe(false);
      expect((await database.select().from(chatPost)).map(({ status }) => status)).toEqual(["sent", "sent"]);
    });

    it("never posts asks from before the channel was connected, updates, or asks by members in a block", async () => {
      const author = await createSignedInMember(database);
      await postAsk(author.userId, "Old ask from before Slack");
      await connectSlack();
      const blocked = await createSignedInMember(database);
      const other = await createSignedInMember(database);
      await database.insert(memberBlock).values({ blockerId: other.userId, blockedId: blocked.userId });
      await postAsk(blocked.userId, "Ask by a blocked member");
      await database.insert(ask).values({ authorId: author.userId, title: "An update", category: ASK_CATEGORIES.other, kind: "update" });

      await runChatPosts(database, process.env);

      expect(fake.posts).toEqual([]);
    });

    it("stops posting when the token is revoked and says so in plain words", async () => {
      await connectSlack();
      const author = await createSignedInMember(database);
      fake.revoke("slack");
      await postAsk(author.userId, "An ask Slack won't take");

      await runChatPosts(database, process.env);

      const [row] = await database.select().from(chatConnection);
      expect(row?.isRefused).toBe(true);
      expect(row?.lastError).toBe("The bot token was revoked in Slack. Reinstall the app and paste the new token.");
      expect(fake.posts).toEqual([]);
    });

    it("posts nothing while paused, and nothing from the pause after resuming", async () => {
      await connectSlack();
      const author = await createSignedInMember(database);
      await call(postPause, admin, { kind: "slack", isPaused: true });
      await postAsk(author.userId, "Asked during the pause");
      await runChatPosts(database, process.env);
      await call(postPause, admin, { kind: "slack", isPaused: false });

      await runChatPosts(database, process.env);

      expect(fake.posts).toEqual([]);
    });

    it("never holds new asks back behind ones already posted in a busy community", async () => {
      await connectSlack();
      const author = await createSignedInMember(database);
      for (let index = 1; index <= 55; index += 1) await postAsk(author.userId, `Busy ask ${index}`);
      await runChatPosts(database, process.env);
      await postAsk(author.userId, "The newest ask");

      await runChatPosts(database, process.env);

      expect(fake.posts.some(({ text }) => text.includes("The newest ask"))).toBe(true);
    });

    it("doesn't post what came in while the token was refused once a new one is pasted", async () => {
      await connectSlack();
      const author = await createSignedInMember(database);
      fake.revoke("slack");
      await postAsk(author.userId, "Asked while the token was revoked");
      await runChatPosts(database, process.env);
      fake.restore("slack");
      await call(postSlackConnect, admin, { token: FAKE_SLACK_TOKEN, signingSecret: FAKE_SLACK_SIGNING_SECRET });

      await runChatPosts(database, process.env);

      expect(fake.posts).toEqual([]);
    });

    it("posts nothing with the module off", async () => {
      await connectSlack();
      const author = await createSignedInMember(database);
      await saveModuleState(database, chatManifest, false);
      await postAsk(author.userId, "Asked with chat off");

      expect(await runChatPosts(database, process.env)).toEqual([]);
      expect(fake.posts).toEqual([]);
    });

    it("posts one weekly line after the weekly email run, once", async () => {
      await connectSlack();
      const week = readCurrentWeek(new Date(), await readWeeklySchedule(database));
      if (!week) throw new Error("No weekly moment found.");
      const now = new Date(week.at.getTime() + MINUTE_MS);
      await database.update(chatConnection).set({ postsFromAt: new Date(week.at.getTime() - MINUTE_MS) });

      await runChatPosts(database, process.env, now);
      expect(fake.posts).toEqual([]);

      await database.insert(jobLease).values({ name: WEEKLY_EMAIL_JOB_NAME, leasedUntil: now, lastFinishedAt: now });
      await runChatPosts(database, process.env, now);
      await runChatPosts(database, process.env, now);

      expect(fake.posts).toEqual([{ kind: "slack", channel: "#founder-asks", text: expect.stringContaining("this week: 0 intros made, 0 asks open.") }]);
    });
  });

  describe("/ask in Slack", () => {
    let member: Member;

    beforeEach(async () => {
      await connectSlack();
      member = await createSignedInMember(database);
      fake.addSlackUser("U0MEMBER", member.email.toUpperCase());
    });

    it("posts the ask as the member whose verified email matches", async () => {
      const response = await signedSlashCommand({ user_id: "U0MEMBER", text: "An intro to a hospital buyer in the US" });

      expect(response.status).toBe(OK_STATUS);
      expect((await response.json()).text).toContain("Posted to");
      expect(await database.select({ authorId: ask.authorId, title: ask.title }).from(ask)).toEqual([{ authorId: member.userId, title: "An intro to a hospital buyer in the US" }]);
    });

    it("answers at once when posting is slow, then says in Slack when the ask is up", async () => {
      fake.slowSlack(400);
      const body = new URLSearchParams({ command: "/ask", team_id: FAKE_SLACK_TEAM.id, user_id: "U0MEMBER", text: "A slow intro ask", response_url: fake.responseUrl }).toString();
      const request = new Request(`${APP_URL}/api/chat/slack/command`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...signSlackRequest(FAKE_SLACK_SIGNING_SECRET, body) },
        body,
      });

      const response = await answerSlackCommand(database, process.env, request, { replyWithinMs: 50 });

      expect((await response.json()).text).toBe(SLACK_POSTING_NOTE);
      await vi.waitFor(() => expect(fake.commandResponses).toHaveLength(1), { timeout: 5_000 });
      expect(fake.commandResponses[0]).toMatchObject({ responseType: "ephemeral", text: expect.stringContaining("Posted to") });
      expect(await database.select({ title: ask.title }).from(ask)).toEqual([{ title: "A slow intro ask" }]);
    });

    it("refuses a bad signature and an old one", async () => {
      expect((await slashCommand({ user_id: "U0MEMBER", text: "Hi" }, signSlackRequest("not-the-signing-secret-at-all0", "x"))).status).toBe(UNAUTHORIZED_STATUS);
      const sixMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60;
      expect((await signedSlashCommand({ user_id: "U0MEMBER", text: "Hi" }, sixMinutesAgo)).status).toBe(UNAUTHORIZED_STATUS);
      expect(await database.select().from(ask)).toEqual([]);
    });

    it("refuses an email no member has, and one that isn't verified", async () => {
      const stranger = await signedSlashCommand({ user_id: "U0STRANGER", text: "Let me in" });
      await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.userId));
      const unverified = await signedSlashCommand({ user_id: "U0MEMBER", text: "Not yet verified" });

      expect((await stranger.json()).text).toContain("Join");
      expect((await unverified.json()).text).toContain("Join");
      expect(await database.select().from(ask)).toEqual([]);
    });

    it("counts against the weekly allowance", async () => {
      await saveSettings(database, { [ASK_ALLOWANCE_SETTING]: "1" });
      await signedSlashCommand({ user_id: "U0MEMBER", text: "The first ask" });
      const second = await signedSlashCommand({ user_id: "U0MEMBER", text: "The second ask" });

      expect((await second.json()).text).toContain("used this week's 1 asks");
      expect(await database.select().from(ask)).toHaveLength(1);
    });

    it("refuses a command without the connected workspace's id", async () => {
      const response = await signedSlashCommand({ user_id: "U0MEMBER", text: "No team", team_id: "" });

      expect((await response.json()).text).toContain("another Slack workspace");
      expect(await database.select().from(ask)).toEqual([]);
    });

    it("answers 404 with the module off", async () => {
      await saveModuleState(database, chatManifest, false);

      expect((await signedSlashCommand({ user_id: "U0MEMBER", text: "Hi" })).status).toBe(404);
    });
  });
});

describe("the post text", () => {
  it("can't hide a link or mention anyone on Discord, or add markup on Slack", () => {
    const facts = { community: "Northwind", authorName: "Priya", title: "[Free money](https://evil.example) @everyone <!channel>", url: "https://app.example.com/asks" };

    expect(composeAskPost("discord", facts)).toContain(String.raw`\[Free money\]\(https://evil.example\) @` + "​everyone");
    expect(composeAskPost("slack", facts)).toContain("&lt;!channel&gt;");
  });
});

describe("Slack's signature", () => {
  const body = "command=%2Fask&text=hi";
  const now = 1_800_000_000_000;
  const timestamp = String(now / 1000);

  it("accepts Slack's own signature within 5 minutes", () => {
    expect(isSlackSignatureValid("secret", timestamp, signSlackBody("secret", timestamp, body), body, now + 4 * MINUTE_MS)).toBe(true);
  });

  it("refuses a changed body, another secret, a missing header and an old timestamp", () => {
    const signature = signSlackBody("secret", timestamp, body);

    expect(isSlackSignatureValid("secret", timestamp, signature, `${body}x`, now)).toBe(false);
    expect(isSlackSignatureValid("other", timestamp, signature, body, now)).toBe(false);
    expect(isSlackSignatureValid("secret", null, signature, body, now)).toBe(false);
    expect(isSlackSignatureValid("secret", timestamp, signature, body, now + 6 * MINUTE_MS)).toBe(false);
  });
});
