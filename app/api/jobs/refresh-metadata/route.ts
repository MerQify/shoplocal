import { getJobsEnv, readOptional } from "@/lib/config";
import { refreshAllVendorsMetadata } from "@/lib/cloudflare-metadata";
import { timingSafeEqual } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

/**
 * Scheduled job endpoint to refresh Cloudflare-native metadata cache.
 * Called overnight by the scheduler (`DAILY_CRON = "0 3 * * *"`) and post-deploy.
 *
 * Authenticated via `x-job-token` matching `JOB_INVOCATION_TOKEN`.
 */
export async function POST(request: Request) {
  const token = readOptional(getJobsEnv)?.JOB_INVOCATION_TOKEN;
  if (!token) {
    console.error("[metadata-job] JOB_INVOCATION_TOKEN is unset");
    return Response.json({ error: "Job invocation is not configured" }, { status: 503 });
  }

  const supplied = request.headers.get("x-job-token");
  if (!supplied || !timingSafeEqual(supplied, token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllVendorsMetadata();
    return Response.json(result);
  } catch (error) {
    console.error("[metadata-job] Refreshing metadata failed:", error);
    return Response.json(
      {
        error: "Failed to refresh metadata",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
