import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #1714 R13 — `/api/health` is public. A thrown driver message can name the database host, so the
 * body carries a fixed string and the real message goes to the log.
 */

const findFirst = vi.fn();
const getReferenceStatus = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({ healthCheck: { findFirst: (...a: unknown[]) => findFirst(...a) } }),
}));
vi.mock("@/lib/config", () => ({
  getEnv: () => ({ S3_ENDPOINT: "e", S3_BUCKET: "b", S3_ACCESS_KEY: "k", CDN_BASE_URL: null }),
  readEnv: () => "abc1234",
}));
vi.mock("@/lib/reference/reference-status-service", () => ({
  getReferenceStatus: (...a: unknown[]) => getReferenceStatus(...a),
}));

const SECRET_HOST = "ep-secret-host-123.neon.tech";

afterEach(() => {
  vi.restoreAllMocks();
  findFirst.mockReset();
  getReferenceStatus.mockReset();
});

describe("/api/health error text (#1714)", () => {
  it("hides a database error message and logs it instead", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockRejectedValue(new Error(`connect ECONNREFUSED ${SECRET_HOST}`));
    getReferenceStatus.mockResolvedValue({ configured: true, reachable: true, sources: [] });
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();
    const body = (await res.json()) as Record<string, any>;

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.db).toEqual({ ok: false, error: "database unavailable" });
    expect(JSON.stringify(body)).not.toContain(SECRET_HOST);
    expect(log.mock.calls.flat().join(" ")).toContain(SECRET_HOST);
  });

  it("hides a reference error message and logs it instead", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockResolvedValue({ label: "dev", checkedAt: new Date() });
    getReferenceStatus.mockRejectedValue(new Error(`timeout reaching ${SECRET_HOST}`));
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();
    const body = (await res.json()) as Record<string, any>;

    expect(res.status).toBe(200);
    expect(body.db.ok).toBe(true);
    expect(body.reference).toEqual({
      configured: false,
      reachable: false,
      error: "reference status unavailable",
    });
    expect(JSON.stringify(body)).not.toContain(SECRET_HOST);
    expect(log.mock.calls.flat().join(" ")).toContain(SECRET_HOST);
  });
});
