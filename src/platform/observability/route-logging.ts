const INTERNAL_ERROR_STATUS = 500;

// Drizzle puts query params in error messages, so prefer the driver error it wraps.
export function readErrorReason(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  return error.cause instanceof Error ? error.cause.message : error.message;
}

export function logError(scope: string, error: unknown) {
  console.error(JSON.stringify({ level: "error", scope, reason: readErrorReason(error) }));
}

export function logAdminAction(action: string, adminId: string, target: string) {
  console.log(JSON.stringify({ level: "info", scope: "admin", action, adminId, target }));
}

export function withRouteLogging<Arguments extends unknown[]>(
  scope: string,
  handler: (...handlerArguments: Arguments) => Promise<Response>,
) {
  return async (...handlerArguments: Arguments) => {
    try {
      return await handler(...handlerArguments);
    } catch (error) {
      logError(scope, error);
      return Response.json({ message: "Something went wrong on our side. Try again in a moment." }, { status: INTERNAL_ERROR_STATUS });
    }
  };
}

export function withLoggedFallback<Result>(scope: string, fallback: Result, read: () => Promise<Result>) {
  return async () => {
    try {
      return await read();
    } catch (error) {
      logError(scope, error);
      return fallback;
    }
  };
}
