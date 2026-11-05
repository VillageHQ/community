const PAYLOAD_TOO_LARGE_STATUS = 413;

async function readBodyWithin(request: Request, maximumBytes: number) {
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > maximumBytes) return null;

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}

export function withBodyLimit<Arguments extends unknown[]>(
  maximumBytes: number,
  handler: (request: Request, ...handlerArguments: Arguments) => Promise<Response>,
  tooLargeMessage = "The request body is too large.",
) {
  return async (request: Request, ...handlerArguments: Arguments) => {
    if (!request.body) return handler(request, ...handlerArguments);

    const body = await readBodyWithin(request, maximumBytes);
    if (!body) {
      return Response.json(
        { message: tooLargeMessage },
        { status: PAYLOAD_TOO_LARGE_STATUS },
      );
    }

    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    });
    return handler(boundedRequest, ...handlerArguments);
  };
}

export const MAXIMUM_JSON_BODY_BYTES = 16 * 1024;
