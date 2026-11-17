import { describe, it, expect, vi, beforeEach } from "vitest";

const requireVendorRole = vi.fn();

vi.mock("@/lib/auth-rbac", () => ({
  requireVendorRole: (...args: any[]) => requireVendorRole(...args),
}));

vi.mock("@/lib/product-templates/service", () => ({
  generateUniversalStockCsv: vi.fn(async () => "Product ID,Product Name*\n123,Test"),
  generateBlankUniversalCsv: vi.fn(() => "Product ID,Product Name*\n"),
  generateBlankEssentialCsv: vi.fn(() => "Product ID,Product Name*\n"),
}));

describe("Platform Stock Export Route RBAC (#1634)", () => {
  beforeEach(() => {
    requireVendorRole.mockReset();
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

  it("redirects 302 to static asset when format is xlsx (#1642)", async () => {
    requireVendorRole.mockResolvedValue({
      ok: true,
      role: "ADMIN",
      vendorId: "vendor-1",
      via: "platform-admin",
    });
    const { GET } = await import("@/app/(admin)/staff/platform/stock-export/export/route");

    const req = new Request(
      "http://localhost/staff/platform/stock-export/export?type=master&format=xlsx",
    );
    const res = await GET(req);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "http://localhost/templates/aheed-food-centre-master-stock-export.xlsx",
    );
  });
});
