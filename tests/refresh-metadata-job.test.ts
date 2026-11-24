import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefreshAll } = vi.hoisted(() => ({
  mockRefreshAll: vi.fn().mockResolvedValue({
    ok: true,
    refreshedCount: 2,
    timestamp: "2026-11-24T03:00:00.000Z",
  }),
}));

vi.mock("@/lib/config", () => ({
  getJobsEnv: () => ({ JOB_INVOCATION_TOKEN: "metadata-test-token" }),
  readOptional: (read: () => unknown) => read(),
}));

vi.mock("@/lib/cloudflare-metadata", () => ({
  refreshAllVendorsMetadata: mockRefreshAll,
}));

import { POST } from "@/app/api/jobs/refresh-metadata/route";

beforeEach(() => vi.clearAllMocks());

describe("Refresh Metadata Job Route", () => {
  it("rejects unauthorized invocations with missing or wrong x-job-token", async () => {
    const url = "https://test.invalid/api/jobs/refresh-metadata";

    // 1. Missing header
    const noTokenRes = await POST(new Request(url, { method: "POST" }));
    expect(noTokenRes.status).toBe(401);
    expect(mockRefreshAll).not.toHaveBeenCalled();

    // 2. Invalid header
    const wrongTokenRes = await POST(
      new Request(url, {
        method: "POST",
        headers: { "x-job-token": "wrong-token" },
      }),
    );
    expect(wrongTokenRes.status).toBe(401);
    expect(mockRefreshAll).not.toHaveBeenCalled();
  });

  it("authenticates valid token and triggers refreshAllVendorsMetadata", async () => {
    const url = "https://test.invalid/api/jobs/refresh-metadata";
    const res = await POST(
      new Request(url, {
        method: "POST",
        headers: { "x-job-token": "metadata-test-token" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRefreshAll).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      refreshedCount: 2,
      timestamp: "2026-11-24T03:00:00.000Z",
    });
  });
});
