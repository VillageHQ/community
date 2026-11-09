import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const TOKEN_PREFIX = "fake-token.";
const FAKE_REQUEST_ID = "req_fake";
const FAKE_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const LINKEDIN_PERSON_URL_PATTERN = /linkedin\.com\/in\/[^/?#\s]+/i;

export function readFetchedUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

export const FAKE_VILLAGE_KEYS = { publicKey: "pk_fake", secretKey: "sk_fake_never_expose" };

type RecordedRequest = {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: unknown;
};

type FakeFailure = { status: number; type: string };
type FakeNetworkStatus = "not_connected" | "syncing" | "ready" | "needs_attention";
type FakeVillageUser = { status: FakeNetworkStatus; email?: string };
type FakeRelationship = { first_name: string; last_name: string; linkedin_url: string; headline?: string };
type FakeScoreMeta = { title: string; description: string };
type FakePath = {
  degree: number;
  description: string;
  introducer: FakeRelationship;
  starter?: FakeRelationship;
  isStarterCurrentUser?: boolean;
  introducerMeta?: FakeScoreMeta[];
  starterMeta?: FakeScoreMeta[];
};
type FakeTarget = { first_name?: string; last_name?: string; full_name?: string };
type FakePaths = { summary: string; paths: FakePath[]; target?: FakeTarget };
type FakePerson = { full_name: string; linkedin_url: string; headline?: string };

type FakeVillageState = {
  requests: RecordedRequest[];
  linkedMembers: Map<string, FakeVillageUser>;
  mintedEmails: Map<string, string>;
  unparsableBodyPaths: Set<string>;
  leftMembers: Set<string>;
  groupCreatorIds: Set<string>;
  isLeaveStrict: boolean;
  delayMsByPath: Map<string, number>;
  isUnlinkedOnPathsRequest: boolean;
  isUnlinkedOnLeaveRequest: boolean;
  bearerRejectionsLeft: number;
  htmlFailureStatusByPath: Map<string, number>;
  failures: Map<string, FakeFailure>;
  searchPeople: FakePerson[];
  searchSource: string | undefined;
  pathsByUrl: Map<string, FakePaths>;
  joinedMembers: Set<string>;
  createdGroups: string[];
  inviteLink: string;
  isPathsNotSynced: boolean;
};

export function createFakeVillageState(): FakeVillageState {
  return {
    requests: [],
    linkedMembers: new Map(),
    mintedEmails: new Map(),
    unparsableBodyPaths: new Set(),
    leftMembers: new Set(),
    groupCreatorIds: new Set(),
    isLeaveStrict: false,
    delayMsByPath: new Map(),
    isUnlinkedOnPathsRequest: false,
    isUnlinkedOnLeaveRequest: false,
    bearerRejectionsLeft: 0,
    htmlFailureStatusByPath: new Map(),
    failures: new Map(),
    searchPeople: [],
    searchSource: "network",
    pathsByUrl: new Map(),
    joinedMembers: new Set(),
    createdGroups: [],
    inviteLink: "https://village.test/join/invite-code",
    isPathsNotSynced: false,
  };
}

function readBody(request: IncomingMessage) {
  return new Promise<unknown>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString();
      resolve(text ? JSON.parse(text) : null);
    });
  });
}

function respond(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function respondWithData(response: ServerResponse, status: number, data: unknown, metadata: object = {}) {
  respond(response, status, { data, metadata: { request_id: FAKE_REQUEST_ID, ...metadata } });
}

const FLAT_ERROR_BODIES: Record<number, object> = {
  402: {
    error: "insufficient_credits",
    message: "Insufficient credits. Top up to continue.",
    topup_url: "https://village.test/platform/settings/billing",
    credits_left: 0,
  },
  429: {
    error: "Rate limit exceeded",
    message: "Too many requests for this user",
    details: { limit: 1, remaining: 0, reset: 1 },
  },
};

function respondWithError(response: ServerResponse, status: number, type: string, fieldErrors?: object[]) {
  const flatBody = FLAT_ERROR_BODIES[status];
  if (flatBody) return respond(response, status, flatBody);
  respond(response, status, {
    error: {
      type,
      title: "Fake",
      status,
      detail: "fake",
      trace_id: "trace_fake",
      ...(fieldErrors ? { errors: fieldErrors } : {}),
    },
    metadata: { request_id: FAKE_REQUEST_ID, timestamp: FAKE_TIMESTAMP },
  });
}

function respondWithInvalidField(response: ServerResponse, field: string) {
  respondWithError(response, 422, "validation_error", [{ field, message: "fake", code: "REQUIRED_FIELD" }]);
}

function readExternalId(request: IncomingMessage) {
  const authorization = request.headers.authorization ?? "";
  return authorization.startsWith(`Bearer ${TOKEN_PREFIX}`)
    ? authorization.slice(`Bearer ${TOKEN_PREFIX}`.length)
    : null;
}

function readObjectField(body: unknown, field: string) {
  if (typeof body !== "object" || body === null) return "";
  const value = Object.entries(body).find(([key]) => key === field)?.[1];
  return typeof value === "string" ? value : "";
}

function toVillageProfile(profile: FakeRelationship) {
  return { headline: "Headline", avatar: "", title: "Title", company: "Company", ...profile };
}

function toVillageSearchPerson({ full_name, linkedin_url, headline }: FakePerson, id: number) {
  const [first_name = "", ...lastNames] = full_name.split(" ");
  return {
    id,
    first_name,
    last_name: lastNames.join(" "),
    full_name,
    linkedin_url,
    headline,
    about_me: null,
    location: { city: "City", state: null, country: "Country" },
    work_relevant: { title: "Title", start_date: FAKE_TIMESTAMP, end_date: null, company: { id, name: "Company" } },
    education_relevant: null,
    image_url: "",
    relationship_cached: { id: "relationship", linkedin_identifier: "", paths: { count: 0, avatars: [], team_only: false }, warmth_score: 0 },
    last_enrichment_at: FAKE_TIMESTAMP,
  };
}

const INTEGRATION_STATUSES: Record<FakeNetworkStatus, string | null> = {
  not_connected: null,
  syncing: "syncing",
  ready: "synced",
  needs_attention: "needs_reauth",
};

const UNLINKED_USER_STATUS = { status: "not_connected", email: null, integrations: [], network_updated_at: null };

function toVillageUserStatus(state: FakeVillageState, externalId: string, linked: FakeVillageUser | undefined) {
  if (!linked) return UNLINKED_USER_STATUS;
  const integrationStatus = INTEGRATION_STATUSES[linked.status];
  const hasNetwork = linked.status === "ready" || linked.status === "needs_attention";
  return {
    status: linked.status,
    email: linked.email ?? state.mintedEmails.get(externalId) ?? null,
    integrations: integrationStatus
      ? [{ id: 1, type: "linkedin", status: integrationStatus, account: null, last_synced_at: hasNetwork ? FAKE_TIMESTAMP : null }]
      : [],
    network_updated_at: hasNetwork ? FAKE_TIMESTAMP : null,
  };
}

const DEFAULT_FAKE_TARGET: FakeTarget = { first_name: "Target", last_name: "Person", full_name: "Target Person" };

function toVillagePaths({ summary, paths, target = DEFAULT_FAKE_TARGET }: FakePaths) {
  return {
    person: { linkedin_url: "", avatar: "", village_url: "", first_name: "", last_name: "", full_name: "", ...target },
    summary: { score: 1, score_label: "Okay", description: summary },
    count: paths.length,
    paths: paths.map(({ degree, description, introducer, starter, isStarterCurrentUser, introducerMeta, starterMeta }) => ({
      degree,
      summary: { score: 1, score_label: "Okay", description },
      introducer: { profile: toVillageProfile(introducer), score: 1, score_label: "Okay", score_meta: introducerMeta ?? [] },
      starters: starter
        ? [
            {
              profile: toVillageProfile(starter),
              score: 1,
              score_label: "Okay",
              score_description: "Okay",
              score_meta: starterMeta ?? [],
              is_current_user: isStarterCurrentUser ?? false,
            },
          ]
        : [],
      score_meta: introducerMeta ?? [],
    })),
  };
}

function respondToAuthenticated(
  state: FakeVillageState,
  { method, path }: Pick<RecordedRequest, "method" | "path">,
  body: unknown,
  externalId: string,
  response: ServerResponse,
) {
  if (path === "/v2/app") {
    return respondWithData(response, 200, {
      title: "Fake app",
      description: "Fake",
      domain_name: "community.test",
      logo: null,
      public_key: FAKE_VILLAGE_KEYS.publicKey,
      is_active: true,
    });
  }

  if (path === "/v2/people/search" && !readObjectField(body, "prompt")) {
    return respondWithInvalidField(response, "prompt");
  }
  const linked = state.linkedMembers.get(externalId);
  if (path === "/v2/user/status") return respondWithData(response, 200, toVillageUserStatus(state, externalId, linked));
  if (path === "/v2/people/search" && !linked) {
    return respondWithError(response, 403, "authorization_error");
  }
  if (!linked) return respondWithError(response, 404, "not_found");

  if (path === "/v2/groups" && method === "GET") {
    return respondWithData(response, 200, {
      groups: [{ id: "group-1", name: "Group", logo: null, invite_link: state.inviteLink, is_admin: true }],
    });
  }
  if (path === "/v2/groups") {
    state.createdGroups.push(readObjectField(body, "name"));
    return respondWithData(response, 201, { id: "group-1", name: "Group", logo: null, invite_link: state.inviteLink });
  }
  if (path === "/v2/groups/join") {
    if (state.joinedMembers.has(externalId)) return respondWithError(response, 409, "conflict");
    state.joinedMembers.add(externalId);
    return respondWithData(response, 200, { success: true, message: "Joined" });
  }
  if (path === "/v2/groups/leave") {
    if (state.isUnlinkedOnLeaveRequest) {
      state.linkedMembers.delete(externalId);
      return respondWithError(response, 404, "not_found");
    }
    if (state.groupCreatorIds.has(externalId)) return respondWithError(response, 400, "bad_request");
    if (!state.joinedMembers.has(externalId) && state.isLeaveStrict) return respondWithError(response, 404, "not_found");
    state.leftMembers.add(externalId);
    return respondWithData(response, 200, { success: true, message: "Left" });
  }
  if (path === "/v2/people/search") {
    respond(response, 200, {
      data: state.searchPeople.map(toVillageSearchPerson),
      metadata: {
        request_id: FAKE_REQUEST_ID,
        mode: "simple",
        source: state.searchSource,
        network_stage_complete: true,
        generated_sql: "",
        search_engine: "fake",
        screening_criteria: [],
        counts_token: "",
        search_execution_token: "",
      },
      pagination: { cursor: "", has_next_page: false, count: state.searchPeople.length },
    });
    return;
  }
  if (path === "/v2/people/paths") {
    if (state.isUnlinkedOnPathsRequest) {
      state.linkedMembers.delete(externalId);
      return respondWithError(response, 404, "not_found");
    }
    if (state.isPathsNotSynced) return respondWithError(response, 409, "network_not_synced");
    const linkedinUrl = readObjectField(body, "linkedin_url");
    if (!LINKEDIN_PERSON_URL_PATTERN.test(linkedinUrl)) return respondWithInvalidField(response, "linkedin_url");
    const paths = state.pathsByUrl.get(linkedinUrl);
    if (!paths) return respondWithError(response, 404, "not_found");
    return respondWithData(response, 200, toVillagePaths(paths), { counts: { total: { value: paths.paths.length } } });
  }
  return respondWithError(response, 404, "not_found");
}

async function handleRequest(state: FakeVillageState, request: IncomingMessage, response: ServerResponse) {
  const path = request.url ?? "";
  const body = await readBody(request);
  state.requests.push({ method: request.method ?? "", path, headers: request.headers, body });

  const delayMs = state.delayMsByPath.get(path);
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

  const failure = state.failures.get(path);
  if (failure) return respondWithError(response, failure.status, failure.type);
  const htmlFailureStatus = state.htmlFailureStatusByPath.get(path);
  if (htmlFailureStatus) {
    response.writeHead(htmlFailureStatus, { "Content-Type": "text/html" });
    response.end("<html>Bad gateway</html>");
    return;
  }
  if (state.unparsableBodyPaths.has(path)) {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<html>not json</html>");
    return;
  }

  if (path === "/v2/auth/tokens") {
    if (request.headers["secret-key"] !== FAKE_VILLAGE_KEYS.secretKey) {
      return respondWithError(response, 401, "authentication_error");
    }
    const externalId = readObjectField(body, "external_user_id");
    const email = readObjectField(body, "email");
    if (!email) return respondWithInvalidField(response, "email");
    state.mintedEmails.set(externalId, email);
    const token = `${TOKEN_PREFIX}${externalId}`;
    return respondWithData(response, 200, { token, token_type: "Bearer", expires_in: 1, expires_at: 1 });
  }

  const callerId = readExternalId(request);
  if (!callerId) return respondWithError(response, 401, "authentication_error");
  if (state.bearerRejectionsLeft > 0) {
    state.bearerRejectionsLeft -= 1;
    return respondWithError(response, 401, "authentication_error");
  }
  return respondToAuthenticated(state, { method: request.method ?? "", path }, body, callerId, response);
}

export async function startFakeVillageServer() {
  const state = createFakeVillageState();
  const server = createServer((request, response) => {
    void handleRequest(state, request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("The fake server has no port.");

  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    readRequests: (path: string) => state.requests.filter((request) => request.path === path),
    reset: () => Object.assign(state, createFakeVillageState()),
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}
