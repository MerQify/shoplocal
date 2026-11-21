import { getJobsEnv, readOptional } from "@/lib/config";
import { sweepExpiredData } from "@/lib/data-retention-service";
import { timingSafeEqual } from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readOptional(getJobsEnv)?.JOB_INVOCATION_TOKEN;
  if (!token) {
    console.error("data retention job token is unset");
    return Response.json({ error: "Job invocation is not configured" }, { status: 503 });
  }
  const supplied = request.headers.get("x-job-token");
  if (!supplied || !timingSafeEqual(supplied, token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await sweepExpiredData());
}
