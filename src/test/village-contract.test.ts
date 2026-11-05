import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVillageGroup,
  createVillageSession,
  joinVillageGroup,
  leaveVillageGroup,
  readVillageAppPublicKey,
  readVillagePaths,
  readVillageUser,
  searchVillageNetwork,
  VillageApiError,
  VILLAGE_LEAVE_OUTCOMES,
} from "../lib/village/client.ts";
import { FAKE_VILLAGE_KEYS, startFakeVillageServer } from "./fake-village-server.ts";
import {
  type ResponseShape,
  VILLAGE_APP_SHAPE,
  VILLAGE_CREATED_GROUP_SHAPE,
  VILLAGE_CREDITS_ERROR_SHAPE,
  VILLAGE_ERROR_SHAPE,
  VILLAGE_GROUP_CHANGE_SHAPE,
  VILLAGE_GROUPS_SHAPE,
  VILLAGE_PATHS_SHAPE,
  VILLAGE_RATE_LIMIT_ERROR_SHAPE,
  VILLAGE_SEARCH_SHAPE,
  VILLAGE_TOKEN_SHAPE,
  VILLAGE_USER_SHAPE,
  VILLAGE_VALIDATION_ERROR_SHAPE,
} from "./village-recorded-responses.ts";

const MEMBER = { externalId: "member-1", email: "member@example.com" };
const TARGET_URL = "https://linkedin.com/in/target-person";
const ONE_MINUTE_MS = 60_000;

function readValueType(value: unknown) {
  return value === null ? "null" : typeof value;
}

function findDrift(recorded: ResponseShape, actual: unknown, path = "body"): string[] {
  if (typeof recorded === "string") {
    return recorded.split("|").includes(readValueType(actual)) ? [] : [`${path}: expected ${recorded}, got ${readValueType(actual)}`];
  }
  if (Array.isArray(recorded)) {
    if (!Array.isArray(actual)) return [`${path}: expected an array, got ${readValueType(actual)}`];
    return actual.flatMap((element, index) => recorded.flatMap((shape: ResponseShape) => findDrift(shape, element, `${path}[${index}]`)));
  }
  if (typeof actual !== "object" || actual === null) return [`${path}: expected an object, got ${readValueType(actual)}`];

  const recordedFields = Object.entries(recorded);
  const extraFields = Object.keys(actual).filter((field) => !recordedFields.some(([recordedField]) => recordedField === field));
  return [
    ...extraFields.map((field) => `${path}.${field}: Village doesn't send this`),
    ...recordedFields.flatMap(([field, shape]) =>
      findDrift(shape, Object.entries(actual).find(([actualField]) => actualField === field)?.[1], `${path}.${field}`),
    ),
  ];
}

function fillShape(shape: ResponseShape): unknown {
  if (typeof shape === "string") return FILLERS[shape.split("|")[0] ?? ""];
  if (Array.isArray(shape)) return shape.map(fillShape);
  return Object.fromEntries(Object.entries(shape).map(([field, fieldShape]) => [field, fillShape(fieldShape)]));
}

const FILLERS: Record<string, unknown> = { string: "text", number: 1, boolean: true, object: {} };

describe("the recorded Village responses", () => {
  afterAll(() => vi.unstubAllGlobals());

  function createTestSession() {
    const session = createVillageSession(
      { apiUrl: "https://village.test", secretKey: "secret", deadlineAtMs: Date.now() + ONE_MINUTE_MS },
      MEMBER,
    );
    return { ...session, withToken: <Result>(call: (token: string) => Promise<Result>) => call("token") };
  }

  function session(shape: ResponseShape) {
    vi.stubGlobal("fetch", async () => Response.json(fillShape(shape)));
    return createTestSession();
  }

  it("parse into the app's public key", async () => {
    await expect(readVillageAppPublicKey(session(VILLAGE_APP_SHAPE))).resolves.toBe("text");
  });

  it("parse into the linked user", async () => {
    await expect(readVillageUser(session(VILLAGE_USER_SHAPE))).resolves.toEqual({ email: "text", isSyncComplete: true });
  });

  it("parse into the created group", async () => {
    await expect(createVillageGroup(session(VILLAGE_CREATED_GROUP_SHAPE), "Group")).resolves.toEqual({
      id: "text",
      inviteLink: "text",
    });
  });

  it("parse a join and a leave", async () => {
    await expect(joinVillageGroup(session(VILLAGE_GROUP_CHANGE_SHAPE), "link")).resolves.toBeUndefined();
    await expect(leaveVillageGroup(session(VILLAGE_GROUP_CHANGE_SHAPE), "group")).resolves.toBe(VILLAGE_LEAVE_OUTCOMES.left);
  });

  it("parse into searched people and their source", async () => {
    const { people, source } = await searchVillageNetwork(session(VILLAGE_SEARCH_SHAPE), "founders");

    expect(source).toBe("text");
    expect(people).toEqual([
      { first_name: "text", last_name: "text", full_name: "text", linkedin_url: "text", headline: "text" },
    ]);
  });

  it("parse into paths with an introducer and a starter", async () => {
    const paths = await readVillagePaths(session(VILLAGE_PATHS_SHAPE), TARGET_URL);

    expect(paths.person?.full_name).toBe("text");
    expect(paths.paths[0]?.introducer?.profile.linkedin_url).toBe("text");
    expect(paths.paths[0]?.starters[0]?.is_current_user).toBe(true);
    expect(paths.paths[0]?.starters[0]?.score_meta?.[0]?.description).toBe("text");
  });

  describe.each([
    { name: "the error object", shape: VILLAGE_ERROR_SHAPE, status: 404, type: "text" },
    { name: "the validation error object", shape: VILLAGE_VALIDATION_ERROR_SHAPE, status: 422, type: "text" },
    { name: "the flat credits error", shape: VILLAGE_CREDITS_ERROR_SHAPE, status: 402, type: "text" },
    { name: "the flat rate limit error", shape: VILLAGE_RATE_LIMIT_ERROR_SHAPE, status: 429, type: "text" },
  ])("with $name", ({ shape, status, type }) => {
    it("surfaces Village's type", async () => {
      vi.stubGlobal("fetch", async () => Response.json(fillShape(shape), { status }));
      const error = await searchVillageNetwork(createTestSession(), "founders").catch((failure: unknown) => failure);

      expect(error).toBeInstanceOf(VillageApiError);
      expect(error).toMatchObject({ status, type, isVillageErrorResponse: true });
    });
  });
});

describe("the fake Village server", () => {
  let village: Awaited<ReturnType<typeof startFakeVillageServer>>;

  beforeAll(async () => {
    vi.unstubAllGlobals();
    village = await startFakeVillageServer();
  });
  afterAll(() => village.stop());
  beforeEach(() => {
    village.reset();
    village.state.linkedMembers.set(MEMBER.externalId, { isSynced: true });
  });

  async function callFake(path: string, init: { method?: string; body?: object; bearer?: string; secretKey?: string } = {}) {
    const { method = "GET", body, bearer = `fake-token.${MEMBER.externalId}`, secretKey } = init;
    const headers = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${bearer}` });
    if (secretKey) headers.set("secret-key", secretKey);
    const response = await fetch(`${village.url}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }

  const validMint = { external_user_id: MEMBER.externalId, email: MEMBER.email };
  const unlinkedBearer = "fake-token.someone-unlinked";

  it.each<[string, () => ReturnType<typeof callFake>, number, ResponseShape]>([
    ["a minted token", () => callFake("/v2/auth/tokens", { method: "POST", body: validMint, secretKey: FAKE_VILLAGE_KEYS.secretKey }), 200, VILLAGE_TOKEN_SHAPE],
    ["a wrong secret key", () => callFake("/v2/auth/tokens", { method: "POST", body: validMint, secretKey: "wrong" }), 401, VILLAGE_ERROR_SHAPE],
    ["a mint with no email", () => callFake("/v2/auth/tokens", { method: "POST", body: { external_user_id: "someone" }, secretKey: FAKE_VILLAGE_KEYS.secretKey }), 422, VILLAGE_VALIDATION_ERROR_SHAPE],
    ["the app", () => callFake("/v2/app"), 200, VILLAGE_APP_SHAPE],
    ["the linked user", () => callFake("/v2/user/me"), 200, VILLAGE_USER_SHAPE],
    ["an unlinked user", () => callFake("/v2/user/me", { bearer: unlinkedBearer }), 404, VILLAGE_ERROR_SHAPE],
    ["a bad bearer token", () => callFake("/v2/user/me", { bearer: "not-a-token" }), 401, VILLAGE_ERROR_SHAPE],
    ["the group list", () => callFake("/v2/groups"), 200, VILLAGE_GROUPS_SHAPE],
    ["a created group", () => callFake("/v2/groups", { method: "POST", body: { name: "Group" } }), 201, VILLAGE_CREATED_GROUP_SHAPE],
    ["a join", () => callFake("/v2/groups/join", { method: "POST", body: { group_invite_link: "link" } }), 200, VILLAGE_GROUP_CHANGE_SHAPE],
    ["a leave", () => callFake("/v2/groups/leave", { method: "POST", body: { group_id: "group-1" } }), 200, VILLAGE_GROUP_CHANGE_SHAPE],
    ["an unlinked search", () => callFake("/v2/people/search", { method: "POST", body: { prompt: "founders" }, bearer: unlinkedBearer }), 403, VILLAGE_ERROR_SHAPE],
    ["a search with no prompt", () => callFake("/v2/people/search", { method: "POST", body: {}, bearer: unlinkedBearer }), 422, VILLAGE_VALIDATION_ERROR_SHAPE],
    ["unlinked paths", () => callFake("/v2/people/paths", { method: "POST", body: {}, bearer: unlinkedBearer }), 404, VILLAGE_ERROR_SHAPE],
    ["paths for an unknown person", () => callFake("/v2/people/paths", { method: "POST", body: { linkedin_url: "https://linkedin.com/in/nobody" } }), 404, VILLAGE_ERROR_SHAPE],
    ["paths for a malformed URL", () => callFake("/v2/people/paths", { method: "POST", body: { linkedin_url: "not a url" } }), 422, VILLAGE_VALIDATION_ERROR_SHAPE],
  ])("answers %s the way Village does", async (_name, call, status, shape) => {
    const response = await call();

    expect(response.status).toBe(status);
    expect(findDrift(shape, response.body)).toEqual([]);
  });

  it("answers a search the way Village does", async () => {
    village.state.searchPeople = [{ full_name: "Target Person", linkedin_url: TARGET_URL, headline: "Founder" }];

    const response = await callFake("/v2/people/search", { method: "POST", body: { prompt: "founders" } });

    expect(response.status).toBe(200);
    expect(findDrift(VILLAGE_SEARCH_SHAPE, response.body)).toEqual([]);
  });

  it("answers paths the way Village does", async () => {
    const person = { first_name: "Dana", last_name: "Connector", linkedin_url: "https://linkedin.com/in/dana" };
    village.state.pathsByUrl.set(TARGET_URL, {
      summary: "Summary",
      paths: [
        {
          degree: 2,
          description: "Path",
          introducer: person,
          introducerMeta: [{ title: "Colleagues", description: "Worked together" }],
          starter: { ...person, last_name: "Starter" },
          starterMeta: [{ title: "Colleagues", description: "Worked together" }],
        },
      ],
    });

    const response = await callFake("/v2/people/paths", { method: "POST", body: { linkedin_url: TARGET_URL } });

    expect(response.status).toBe(200);
    expect(findDrift(VILLAGE_PATHS_SHAPE, response.body)).toEqual([]);
  });

  it.each([
    { status: 402, shape: VILLAGE_CREDITS_ERROR_SHAPE },
    { status: 429, shape: VILLAGE_RATE_LIMIT_ERROR_SHAPE },
  ])("answers a forced $status with Village's flat body", async ({ status, shape }) => {
    village.state.failures.set("/v2/people/search", { status, type: "ignored" });

    const response = await callFake("/v2/people/search", { method: "POST", body: { prompt: "founders" } });

    expect(response.status).toBe(status);
    expect(findDrift(shape, response.body)).toEqual([]);
  });
});
