import { describe, expect, it, vi } from "vitest";
import {
  isRetryableRead,
  isTransientConnectionError,
  runReadWithRetry,
  withReadRetry,
} from "@/lib/db-read-retry";

const noSleep = { sleep: async () => {}, log: () => {} };
const dropped = () => new Error("Network connection lost.");

describe("db read retry (#1666)", () => {
  it("treats only plain SELECTs as retryable reads", () => {
    expect(isRetryableRead('SELECT "public"."Vendor"."id" FROM "public"."Vendor" WHERE 1=1')).toBe(
      true,
    );
    expect(isRetryableRead("  select 1")).toBe(true);
    expect(isRetryableRead('INSERT INTO "Order" ("id") VALUES ($1) RETURNING "id"')).toBe(false);
    expect(isRetryableRead('UPDATE "Product" SET "stock" = $1 RETURNING "id"')).toBe(false);
    expect(isRetryableRead('DELETE FROM "CartItem" WHERE "id" = $1')).toBe(false);
    expect(isRetryableRead('SELECT "id" FROM "Product" WHERE "id" = $1 FOR UPDATE')).toBe(false);
    expect(isRetryableRead("WITH x AS (UPDATE t SET a = 1 RETURNING *) SELECT * FROM x")).toBe(
      false,
    );
  });

  it("recognises dropped-connection errors, including through the cause chain", () => {
    expect(isTransientConnectionError(dropped())).toBe(true);
    expect(
      isTransientConnectionError(
        new Error("Error connecting to database: TypeError: fetch failed"),
      ),
    ).toBe(true);
    expect(isTransientConnectionError(new Error("Server error (HTTP status 503): upstream"))).toBe(
      true,
    );
    expect(isTransientConnectionError(Object.assign(new Error("x"), { code: "57P01" }))).toBe(true);
    expect(isTransientConnectionError(new Error("wrapped", { cause: dropped() }))).toBe(true);
    expect(
      isTransientConnectionError(
        Object.assign(new Error("y"), { sourceError: new Error("fetch failed") }),
      ),
    ).toBe(true);
  });

  it("never treats a query error as transient", () => {
    expect(
      isTransientConnectionError(Object.assign(new Error("duplicate key"), { code: "23505" })),
    ).toBe(false);
    expect(isTransientConnectionError(new Error('column "x" does not exist'))).toBe(false);
    expect(
      isTransientConnectionError(new Error("Server error (HTTP status 400): bad request")),
    ).toBe(false);
  });

  it("retries a read after a dropped connection and returns the second result", async () => {
    const run = vi.fn().mockRejectedValueOnce(dropped()).mockResolvedValueOnce("rows");
    const log = vi.fn();
    await expect(runReadWithRetry("SELECT 1", run, { ...noSleep, log })).resolves.toBe("rows");
    expect(run).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0][0]).toBe("[db-retry] read retry 1/2 after: Network connection lost.");
  });

  it("gives up after two retries and rethrows the last error", async () => {
    const run = vi.fn().mockRejectedValue(dropped());
    await expect(runReadWithRetry("SELECT 1", run, noSleep)).rejects.toThrow(
      "Network connection lost.",
    );
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("never retries a write, even on a dropped connection", async () => {
    const run = vi.fn().mockRejectedValue(dropped());
    await expect(
      runReadWithRetry('INSERT INTO "Order" ("id") VALUES ($1) RETURNING "id"', run, noSleep),
    ).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("never retries a read that failed with a query error", async () => {
    const run = vi.fn().mockRejectedValue(Object.assign(new Error("bad"), { code: "42703" }));
    await expect(runReadWithRetry("SELECT x", run, noSleep)).rejects.toThrow("bad");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("wraps only the adapter's queryRaw and forwards everything else", async () => {
    const queryRaw = vi
      .fn()
      .mockRejectedValueOnce(dropped())
      .mockResolvedValueOnce({ columnNames: [], columnTypes: [], rows: [] });
    const executeRaw = vi.fn().mockResolvedValue(1);
    const factory = {
      provider: "postgres" as const,
      adapterName: "@prisma/adapter-neon",
      connect: async () => ({ queryRaw, executeRaw, provider: "postgres" }),
    };
    const wrapped = withReadRetry(factory as never) as unknown as typeof factory;
    expect(wrapped.provider).toBe("postgres");
    expect(wrapped.adapterName).toBe("@prisma/adapter-neon");

    vi.useFakeTimers();
    const adapter = (await wrapped.connect()) as {
      queryRaw: typeof queryRaw;
      executeRaw: typeof executeRaw;
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = adapter.queryRaw({ sql: "SELECT 1", args: [], argTypes: [] });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ columnNames: [], columnTypes: [], rows: [] });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    warn.mockRestore();

    await adapter.executeRaw({ sql: "UPDATE t SET a = 1", args: [], argTypes: [] });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
