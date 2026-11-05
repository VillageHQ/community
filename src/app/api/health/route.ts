import { isAppHealthy } from "@/platform/observability/health";
import { withRouteLogging } from "@/platform/observability/route-logging";

const HEALTHY_STATUS = 200;
const UNAVAILABLE_STATUS = 503;

export const GET = withRouteLogging("health", async () => {
  const isHealthy = await isAppHealthy();
  return Response.json(
    { status: isHealthy ? "ok" : "unavailable" },
    {
      status: isHealthy ? HEALTHY_STATUS : UNAVAILABLE_STATUS,
      headers: { "Cache-Control": "no-store" },
    },
  );
});
