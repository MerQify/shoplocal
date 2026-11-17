import { requireVendorRole } from "@/lib/auth-rbac";
import {
  generateUniversalStockCsv,
  generateEssentialStockCsv,
  generateBlankUniversalCsv,
  generateBlankEssentialCsv,
} from "@/lib/product-templates/service";
import { fetchBundlesForExport, exportBundlesToCsv } from "@/lib/bundle-templates/export";
import { fetchPromotionsForExport, exportPromotionsToCsv } from "@/lib/promotion-templates/export";
import { fetchCategoriesForExport, exportCategoriesToCsv } from "@/lib/category-templates/export";
import { fetchDiscountsForExport, exportDiscountsToCsv } from "@/lib/discount-templates/export";
import { fetchFiltersForExport, exportFiltersToCsv } from "@/lib/filter-templates/export";

/**
 * Platform Admin-only stock, bundle, promotion and template export endpoint.
 *
 * Enforces role-based access control:
 * - 401 if unauthenticated
 * - 403 if authenticated but not platform-admin (`auth.via !== 'platform-admin'`)
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireVendorRole("ADMIN");
  if (!auth.ok) {
    return new Response(auth.status === 401 ? "Sign in required" : "Platform admin only", {
      status: auth.status,
    });
  }
  if (auth.via !== "platform-admin") {
    return new Response("Platform admin only", { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "stock"; // "stock" | "master" | "universal" | "essential" | "bundles" | "promotions" | "categories" | "discounts" | "filters"
  const format = url.searchParams.get("format") || "csv"; // "csv" | "xlsx"
  const statusParam = url.searchParams.get("status");
  const status = statusParam === "all" || statusParam === "archived" ? statusParam : "active";
  const categoryParam = url.searchParams.get("category");
  const category = categoryParam && categoryParam !== "all" ? categoryParam : undefined;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  if (format === "csv") {
    let csvData = "";
    let filename = "";

    if (type === "stock") {
      csvData = await generateUniversalStockCsv(auth.vendorId, { status, category });
      filename = `stock-${status}-export-${dateStr}.csv`;
    } else if (type === "essential") {
      csvData = await generateEssentialStockCsv(auth.vendorId, { status, category });
      filename = `stock-essential-${status}-export-${dateStr}.csv`;
    } else if (type === "bundles") {
      const bundles = await fetchBundlesForExport(auth.vendorId, { status });
      csvData = exportBundlesToCsv(bundles);
      filename = `bundles-${status}-export-${dateStr}.csv`;
    } else if (type === "promotions") {
      const promos = await fetchPromotionsForExport(auth.vendorId, { status });
      csvData = exportPromotionsToCsv(promos);
      filename = `promotions-${status}-export-${dateStr}.csv`;
    } else if (type === "categories") {
      const cats = await fetchCategoriesForExport(auth.vendorId, { status });
      csvData = exportCategoriesToCsv(cats);
      filename = `categories-${status}-export-${dateStr}.csv`;
    } else if (type === "discounts") {
      const discounts = await fetchDiscountsForExport(auth.vendorId, { status });
      csvData = exportDiscountsToCsv(discounts);
      filename = `discount-codes-${status}-export-${dateStr}.csv`;
    } else if (type === "filters") {
      const filters = await fetchFiltersForExport(auth.vendorId);
      csvData = exportFiltersToCsv(filters);
      filename = `filters-attributes-export-${dateStr}.csv`;
    } else if (type === "universal-template" || type === "universal") {
      csvData = generateBlankUniversalCsv();
      filename = "universal-product-template.csv";
    } else if (type === "essential-template") {
      csvData = generateBlankEssentialCsv();
      filename = "essential-product-template.csv";
    } else {
      return new Response(
        "Invalid export type. Allowed: stock, universal, essential, bundles, promotions, categories, discounts, filters",
        {
          status: 400,
        },
      );
    }

    return new Response(csvData, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  if (format === "xlsx") {
    let staticPath = "";

    if (type === "master") {
      staticPath = "/templates/aheed-food-centre-master-stock-export.xlsx";
    } else if (type === "stock") {
      staticPath = "/templates/aheed-food-centre-stock-export.xlsx";
    } else if (type === "essential") {
      staticPath = "/templates/aheed-food-centre-essential-export.xlsx";
    } else if (type === "universal" || type === "universal-template") {
      staticPath = "/templates/universal-product-template.xlsx";
    } else if (type === "essential-template") {
      staticPath = "/templates/essential-product-template.xlsx";
    } else {
      return new Response("Invalid export type. Allowed: master, stock, universal, essential", {
        status: 400,
      });
    }

    return Response.redirect(new URL(staticPath, request.url), 302);
  }

  return new Response("Invalid format: must be 'csv' or 'xlsx'", { status: 400 });
}
