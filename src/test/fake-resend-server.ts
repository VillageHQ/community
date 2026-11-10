import { createServer, type IncomingMessage } from "node:http";

const SUCCESS_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;

export const FAKE_RESEND_API_KEY = "re_fake_never_expose";

type RecordedEmail = { authorization: string | undefined; idempotencyKey: string | string[] | undefined; body: unknown };

const RECEIVED_EMAILS_PATH = "/emails/receiving/";

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) if (Buffer.isBuffer(chunk)) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  const body: unknown = text ? JSON.parse(text) : null;
  return body;
}

export async function startFakeResendServer() {
  // `receivedText` is the body Resend's received-email API gives back for a reply.
  const state: { emails: RecordedEmail[]; failureStatus: number | null; receivedText: string } = { emails: [], failureStatus: null, receivedText: "" };

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url?.startsWith(RECEIVED_EMAILS_PATH)) {
      response.statusCode = request.headers.authorization === `Bearer ${FAKE_RESEND_API_KEY}` ? SUCCESS_STATUS : UNAUTHORIZED_STATUS;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ id: request.url.slice(RECEIVED_EMAILS_PATH.length), text: state.receivedText }));
      return;
    }
    state.emails.push({
      authorization: request.headers.authorization,
      idempotencyKey: request.headers["idempotency-key"],
      body: await readBody(request),
    });
    const isAuthorized = request.headers.authorization === `Bearer ${FAKE_RESEND_API_KEY}`;
    response.statusCode = state.failureStatus ?? (isAuthorized ? SUCCESS_STATUS : UNAUTHORIZED_STATUS);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ id: "fake-email-id" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("The fake Resend server has no port.");

  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    reset: () => {
      state.emails = [];
      state.failureStatus = null;
      state.receivedText = "";
    },
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
