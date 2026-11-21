import { describe, it, expect, vi, beforeEach } from "vitest";

const requireVendorRole = vi.fn();

vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: (...args: any[]) => requireVendorRole(...args),
}));

const generateEssentialStockCsv = vi.fn(
  async (..._args: any[]) => "Product ID [DO NOT EDIT],Product Name*,Category*\n123,Test,Meat",
);

vi.mock("@/lib/product-templates/service", () => ({
  generateUniversalStockCsv: vi.fn(async () => "Product ID,Product Name*\n123,Test"),
  generateEssentialStockCsv: (vendorId: string, options?: any) =>
    generateEssentialStockCsv(vendorId, options),
  generateBlankUniversalCsv: vi.fn(() => "Product ID,Product Name*\n"),
  generateBlankEssentialCsv: vi.fn(() => "Product ID,Product Name*\n"),
  fetchStockRecordsForExport: (...args: any[]) => fetchStockRecordsForExport(...args),
}));

// #1714 — the xlsx branch fetches through these; row mappers stay real so the workbook is genuine.
const fetchStockRecordsForExport = vi.fn(async (..._args: any[]) => [] as any[]);
const fetchCategoriesForExport = vi.fn(async (..._args: any[]) => [] as any[]);
const fetchBundlesForExport = vi.fn(async (..._args: any[]) => [] as any[]);
const fetchPromotionsForExport = vi.fn(async (..._args: any[]) => [] as any[]);
const fetchDiscountsForExport = vi.fn(async (..._args: any[]) => [] as any[]);
const fetchFiltersForExport = vi.fn(async (..._args: any[]) => [] as any[]);

vi.mock("@/lib/category-templates/export", async (orig) => ({
  ...(await orig<object>()),
  fetchCategoriesForExport: (...a: any[]) => fetchCategoriesForExport(...a),
}));
vi.mock("@/lib/bundle-templates/export", async (orig) => ({
  ...(await orig<object>()),
  fetchBundlesForExport: (...a: any[]) => fetchBundlesForExport(...a),
}));
vi.mock("@/lib/promotion-templates/export", async (orig) => ({
  ...(await orig<object>()),
  fetchPromotionsForExport: (...a: any[]) => fetchPromotionsForExport(...a),
}));
vi.mock("@/lib/discount-templates/export", async (orig) => ({
  ...(await orig<object>()),
  fetchDiscountsForExport: (...a: any[]) => fetchDiscountsForExport(...a),
}));
vi.mock("@/lib/filter-templates/export", async (orig) => ({
  ...(await orig<object>()),
  fetchFiltersForExport: (...a: any[]) => fetchFiltersForExport(...a),
}));

const allFetchMocks = [
  fetchStockRecordsForExport,
  fetchCategoriesForExport,
  fetchBundlesForExport,
  fetchPromotionsForExport,
  fetchDiscountsForExport,
  fetchFiltersForExport,
];
const platformAdmin = { ok: true, role: "ADMIN", vendorId: "vendor-1", via: "platform-admin" };
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("Platform Stock Export Route RBAC (#1634)", () => {
  beforeEach(() => {
    requireVendorRole.mockReset();
    for (const m of allFetchMocks) m.mockClear();
  });

  it("returns 401 when user is not authenticated", async () => {
    requireVendorRole.mockResolvedValue({ ok: false, status: 401, reason: "unauthenticated" });
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const req = new Request(
      "http://localhost/staff/platform/stock-export/export?type=stock&format=csv",
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is store admin but NOT platform-admin", async () => {
    requireVendorRole.mockResolvedValue({
      ok: true,
      role: "ADMIN",
      vendorId: "vendor-1",
      via: "vendor-membership", // Store admin, not platform admin!
    });
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const req = new Request(
      "http://localhost/staff/platform/stock-export/export?type=stock&format=csv",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toContain("Platform admin only");
  });

  it("returns 200 with CSV attachment when user is platform-admin", async () => {
    requireVendorRole.mockResolvedValue({
      ok: true,
      role: "ADMIN",
      vendorId: "vendor-1",
      via: "platform-admin",
    });
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const req = new Request(
      "http://localhost/staff/platform/stock-export/export?type=stock&format=csv",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment; filename=");
  });

  it("returns live CSV stock rows when type=essential (#1646)", async () => {
    requireVendorRole.mockResolvedValue({
      ok: true,
      role: "ADMIN",
      vendorId: "vendor-1",
      via: "platform-admin",
    });
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const req = new Request(
      "http://localhost/staff/platform/stock-export/export?type=essential&format=csv&category=meat",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(generateEssentialStockCsv).toHaveBeenCalledWith("vendor-1", {
      status: "active",
      category: "meat",
    });
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="stock-essential-active-export-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const body = await res.text();
    expect(body).toContain("Product ID [DO NOT EDIT]");
    expect(body).toContain("Test");
  });

  it.each([
    ["stock", /^attachment; filename="stock-active-export-\d{4}-\d{2}-\d{2}\.xlsx"$/],
    ["essential", /^attachment; filename="stock-essential-active-export-\d{4}-\d{2}-\d{2}\.xlsx"$/],
    ["master", /^attachment; filename="master-active-export-\d{4}-\d{2}-\d{2}\.xlsx"$/],
  ])("builds type=%s xlsx live — 200, never a redirect (#1714 R6)", async (type, filename) => {
    requireVendorRole.mockResolvedValue(platformAdmin);
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const res = await GET(
      new Request(`http://localhost/staff/platform/stock-export/export?type=${type}&format=xlsx`),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toBe(XLSX_TYPE);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(filename);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  it("passes the CSV branch's status/category to every xlsx fetch (#1714 R7)", async () => {
    requireVendorRole.mockResolvedValue(platformAdmin);
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    await GET(
      new Request(
        "http://localhost/staff/platform/stock-export/export?type=master&format=xlsx&status=all&category=rice",
      ),
    );

    expect(fetchStockRecordsForExport).toHaveBeenCalledWith("vendor-1", {
      status: "all",
      category: "rice",
    });
    for (const m of [
      fetchCategoriesForExport,
      fetchBundlesForExport,
      fetchPromotionsForExport,
      fetchDiscountsForExport,
    ]) {
      expect(m).toHaveBeenCalledWith("vendor-1", { status: "all" });
    }
    expect(fetchFiltersForExport).toHaveBeenCalledWith("vendor-1");
  });

  it("defaults the xlsx fetch to active with no category (#1714 R7)", async () => {
    requireVendorRole.mockResolvedValue(platformAdmin);
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    await GET(
      new Request("http://localhost/staff/platform/stock-export/export?type=stock&format=xlsx"),
    );

    expect(fetchStockRecordsForExport).toHaveBeenCalledWith("vendor-1", {
      status: "active",
      category: undefined,
    });
  });

  it.each([
    [{ ok: false, status: 401, reason: "unauthenticated" }, 401],
    [{ ok: true, role: "ADMIN", vendorId: "vendor-1", via: "vendor-membership" }, 403],
  ])("refuses master xlsx before reading any data (#1714 R8)", async (auth, expected) => {
    requireVendorRole.mockResolvedValue(auth);
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const res = await GET(
      new Request("http://localhost/staff/platform/stock-export/export?type=master&format=xlsx"),
    );

    expect(res.status).toBe(expected);
    for (const m of allFetchMocks) expect(m).not.toHaveBeenCalled();
  });

  it("still redirects blank-template xlsx to the static template (#1714)", async () => {
    requireVendorRole.mockResolvedValue(platformAdmin);
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const res = await GET(
      new Request(
        "http://localhost/staff/platform/stock-export/export?type=essential-template&format=xlsx",
      ),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "http://localhost/templates/essential-product-template.xlsx",
    );
  });
});
