import { beforeEach, expect, it, vi } from "vitest";

const { deleteAttempts, deleteSearch, deleteAssistant } = vi.hoisted(() => ({
  deleteAttempts: vi.fn().mockResolvedValue({ count: 1 }),
  deleteSearch: vi.fn().mockResolvedValue({ count: 2 }),
  deleteAssistant: vi.fn().mockResolvedValue({ count: 3 }),
}));

vi.mock("@/lib/config", () => ({
  getJobsEnv: () => ({ JOB_INVOCATION_TOKEN: "retention-test" }),
  readOptional: (read: () => unknown) => read(),
}));
vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    searchQueryLog: { deleteMany: deleteSearch },
    assistantConversation: { deleteMany: deleteAssistant },
    authenticationAttempt: { deleteMany: deleteAttempts },
    orderLookupAttempt: { deleteMany: deleteAttempts },
    discountCodeAttempt: { deleteMany: deleteAttempts },
    customerFeedbackAttempt: { deleteMany: deleteAttempts },
    listNormalisationAttempt: { deleteMany: deleteAttempts },
  }),
}));

import { POST } from "@/app/api/jobs/sweep-data-retention/route";
import { sweepExpiredData } from "@/lib/data-retention-service";

beforeEach(() => vi.clearAllMocks());

it("requires the scheduler token before deleting rows", async () => {
  const url = "https://test.invalid/api/jobs/sweep-data-retention";
  const rejected = await POST(new Request(url, { method: "POST" }));
  expect(rejected.status).toBe(401);
  expect(deleteSearch).not.toHaveBeenCalled();
  const response = await POST(
    new Request(url, {
      method: "POST",
      headers: { "x-job-token": "retention-test" },
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ searchQueries: 2, assistantConversations: 3 });
});

it("bounds each table and retains records newer than its existing cutoff", async () => {
  await sweepExpiredData(new Date("2026-11-21T03:00:00Z"));
  const expiry = { where: { createdAt: { lt: new Date("2026-08-23T03:00:00Z") } }, limit: 5_000 };
  expect(deleteSearch).toHaveBeenCalledExactlyOnceWith(expiry);
  expect(deleteAssistant).toHaveBeenCalledExactlyOnceWith(expiry);
  expect(deleteAttempts).toHaveBeenCalledTimes(5);
  expect(deleteAttempts).toHaveBeenCalledWith({
    where: { createdAt: { lt: new Date("2026-11-21T02:00:00Z") } },
    limit: 5_000,
  });
});
