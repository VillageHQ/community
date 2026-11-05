import { createServer, type IncomingMessage } from "node:http";

const SUCCESS_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;

export const FAKE_RESEND_API_KEY = "re_fake_never_expose";

type RecordedEmail = { authorization: string | undefined; idempotencyKey: string | string[] | undefined; body: unknown };

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) if (Buffer.isBuffer(chunk)) chunks.push(chunk);
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  return body;
}

export async function startFakeResendServer() {
  const state: { emails: RecordedEmail[]; failureStatus: number | null } = { emails: [], failureStatus: null };

  const server = createServer(async (request, response) => {
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
    },
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
