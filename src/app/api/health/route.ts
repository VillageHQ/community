import { isAppHealthy } from "@/platform/observability/health";
import { platformRoutes } from "@/platform/modules/platform-routes";

const HEALTHY_STATUS = 200;
const UNAVAILABLE_STATUS = 503;

export const GET = platformRoutes.open("health", async () => {
  const isHealthy = await isAppHealthy();
  return Response.json(
    { status: isHealthy ? "ok" : "unavailable" },
    {
      status: isHealthy ? HEALTHY_STATUS : UNAVAILABLE_STATUS,
      headers: { "Cache-Control": "no-store" },
    },
  );
});
