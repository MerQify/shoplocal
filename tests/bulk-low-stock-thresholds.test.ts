import { describe, expect, it, vi } from "vitest";
import { bulkSetLowStockThresholds } from "@/lib/repositories/products";
import { parseLowStockThreshold, MAX_LOW_STOCK_THRESHOLD } from "@/lib/low-stock";

describe("bulkSetLowStockThresholds repository", () => {
  it("rejects non-integer, negative, or excessive threshold values", async () => {
    const dummyPrismaWs = {} as never;
    await expect(bulkSetLowStockThresholds(dummyPrismaWs, "v-1", ["p-1"], -1)).rejects.toThrow(
      "bulkSetLowStockThresholds: threshold must be an integer",
    );

    await expect(bulkSetLowStockThresholds(dummyPrismaWs, "v-1", ["p-1"], 3.5)).rejects.toThrow(
      "bulkSetLowStockThresholds: threshold must be an integer",
    );

    await expect(
      bulkSetLowStockThresholds(dummyPrismaWs, "v-1", ["p-1"], MAX_LOW_STOCK_THRESHOLD + 1),
    ).rejects.toThrow("bulkSetLowStockThresholds: threshold must be an integer");
  });

  it("returns zero counts and does not open transaction when productIds is empty", async () => {
    const $transaction = vi.fn();
    const dummyPrismaWs = { $transaction } as never;

    const result = await bulkSetLowStockThresholds(dummyPrismaWs, "v-1", [], 5);
    expect(result).toEqual({ updated: 0, unchanged: 0, missing: [] });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("correctly identifies updated, unchanged, and missing products in transaction", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([
      { id: "p-1", inventory: { id: "inv-1", lowStockThreshold: 3 } },
      { id: "p-2", inventory: { id: "inv-2", lowStockThreshold: 5 } }, // already 5
    ]);

    const tx = {
      product: { findMany },
      inventory: { upsert },
    };

    const $transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    const prismaWs = { $transaction } as never;

    const result = await bulkSetLowStockThresholds(prismaWs, "v-1", ["p-1", "p-2", "p-missing"], 5);

    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.missing).toEqual(["p-missing"]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { productId: "p-1" },
      create: {
        vendorId: "v-1",
        productId: "p-1",
        quantity: 0,
        stockMode: "UNKNOWN",
        lowStockThreshold: 5,
        version: 1,
      },
      update: {
        lowStockThreshold: 5,
        version: { increment: 1 },
      },
    });
  });
});

describe("parseLowStockThreshold", () => {
  it("accepts valid integers within range", () => {
    expect(parseLowStockThreshold("0")).toEqual({ ok: true, value: 0 });
    expect(parseLowStockThreshold("5")).toEqual({ ok: true, value: 5 });
    expect(parseLowStockThreshold("999")).toEqual({ ok: true, value: 999 });
  });

  it("rejects non-numeric, negative, or out-of-bounds strings", () => {
    expect(parseLowStockThreshold("-1").ok).toBe(false);
    expect(parseLowStockThreshold("abc").ok).toBe(false);
    expect(parseLowStockThreshold("1000").ok).toBe(false);
    expect(parseLowStockThreshold("").ok).toBe(false);
  });
});
