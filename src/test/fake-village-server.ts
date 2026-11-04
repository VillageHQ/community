import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const TOKEN_PREFIX = "fake-token.";

export const FAKE_VILLAGE_KEYS = { publicKey: "pk_fake", secretKey: "sk_fake_never_expose" };

type RecordedRequest = {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: unknown;
};

type FakeFailure = { status: number; type: string };
type FakeRelationship = { first_name: string; last_name: string; linkedin_url: string };
type FakePath = { degree: number; description: string; introducer: FakeRelationship; starter?: FakeRelationship };
type FakePerson = { full_name: string; linkedin_url: string; headline?: string };

type FakeVillageState = {
  requests: RecordedRequest[];
  linkedMembers: Map<string, { isSynced: boolean; email?: string }>;
  mintedEmails: Map<string, string>;
  unparsableBodyPaths: Set<string>;
  leftMembers: Set<string>;
  delayMsByPath: Map<string, number>;
  isUnlinkedOnPathsRequest: boolean;
  isUnlinkedOnLeaveRequest: boolean;
  bearerRejectionsLeft: number;
  htmlFailureStatusByPath: Map<string, number>;
  failures: Map<string, FakeFailure>;
  searchPeople: FakePerson[];
  searchSource: string | undefined;
  pathsByUrl: Map<string, { summary: string; paths: FakePath[] }>;
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

function respondWithError(response: ServerResponse, status: number, type: string) {
  respond(response, status, { error: { type, status, detail: "fake", trace_id: "trace_fake" } });
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
  return { ...profile, headline: "Headline" };
}

function toVillagePaths({ summary, paths }: { summary: string; paths: FakePath[] }) {
  return {
    summary: { score: 1, score_label: "Okay", description: summary },
    count: paths.length,
    paths: paths.map(({ degree, description, introducer, starter }) => ({
      degree,
      summary: { score: 1, score_label: "Okay", description },
      introducer: { profile: toVillageProfile(introducer), score: 1, score_label: "Okay", score_meta: [] },
      starters: starter
        ? [{ profile: toVillageProfile(starter), score: 1, score_label: "Okay", score_meta: [], is_current_user: false }]
        : [],
      score_meta: [],
    })),
  };
}

function respondToAuthenticated(
  state: FakeVillageState,
  path: string,
  body: unknown,
  externalId: string,
  response: ServerResponse,
) {
  if (path === "/v2/app") return respond(response, 200, { data: { public_key: FAKE_VILLAGE_KEYS.publicKey } });

  const linked = state.linkedMembers.get(externalId);
  if (path === "/v2/people/search" && !linked) {
    return respondWithError(response, 403, "authorization_error");
  }
  if (!linked) return respondWithError(response, 404, "not_found");

  if (path === "/v2/user/me") {
    return respond(response, 200, {
      data: {
        id: externalId,
        email: linked.email ?? state.mintedEmails.get(externalId) ?? "",
        is_sync_complete: linked.isSynced,
      },
    });
  }
  if (path === "/v2/groups") {
    state.createdGroups.push(readObjectField(body, "name"));
    return respond(response, 201, { data: { id: "group-1", name: "Group", invite_link: state.inviteLink } });
  }
  if (path === "/v2/groups/join") {
    if (state.joinedMembers.has(externalId)) return respondWithError(response, 409, "conflict");
    state.joinedMembers.add(externalId);
    return respond(response, 200, { data: { success: true, message: "Joined" } });
  }
  if (path === "/v2/groups/leave") {
    if (state.isUnlinkedOnLeaveRequest) {
      state.linkedMembers.delete(externalId);
      return respondWithError(response, 404, "not_found");
    }
    state.leftMembers.add(externalId);
    return respond(response, 200, { data: { success: true, message: "Left" } });
  }
  if (path === "/v2/people/search") {
    return respond(response, 200, { data: state.searchPeople, metadata: { source: state.searchSource } });
  }
  if (path === "/v2/people/paths") {
    if (state.isUnlinkedOnPathsRequest) {
      state.linkedMembers.delete(externalId);
      return respondWithError(response, 404, "not_found");
    }
    if (state.isPathsNotSynced) return respondWithError(response, 409, "network_not_synced");
    const paths = state.pathsByUrl.get(readObjectField(body, "linkedin_url"));
    if (!paths) return respondWithError(response, 404, "not_found");
    return respond(response, 200, { data: toVillagePaths(paths) });
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
    state.mintedEmails.set(externalId, readObjectField(body, "email"));
    const token = `${TOKEN_PREFIX}${externalId}`;
    return respond(response, 200, { data: { token, token_type: "Bearer", expires_in: 1, expires_at: 1 } });
  }

  const callerId = readExternalId(request);
  if (!callerId) return respondWithError(response, 401, "authentication_error");
  if (state.bearerRejectionsLeft > 0) {
    state.bearerRejectionsLeft -= 1;
    return respondWithError(response, 401, "authentication_error");
  }
  return respondToAuthenticated(state, path, body, callerId, response);
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
