import { requireVendorRole } from "@/lib/auth-rbac";
import {
  generateUniversalStockCsv,
  generateBlankUniversalCsv,
  generateBlankEssentialCsv,
} from "@/lib/product-templates/service";
import { fetchBundlesForExport, exportBundlesToCsv } from "@/lib/bundle-templates/export";
import { fetchPromotionsForExport, exportPromotionsToCsv } from "@/lib/promotion-templates/export";
import { fetchCategoriesForExport, exportCategoriesToCsv } from "@/lib/category-templates/export";
import { fetchDiscountsForExport, exportDiscountsToCsv } from "@/lib/discount-templates/export";
import { fetchFiltersForExport, exportFiltersToCsv } from "@/lib/filter-templates/export";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  if (format === "csv") {
    let csvData = "";
    let filename = "";

    if (type === "stock") {
      csvData = await generateUniversalStockCsv(auth.vendorId, { status });
      filename = `stock-${status}-export-${dateStr}.csv`;
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
    } else if (type === "universal") {
      const templatePath = join(
        process.cwd(),
        "public",
        "templates",
        "universal-product-template.csv",
      );
      csvData = existsSync(templatePath)
        ? readFileSync(templatePath, "utf8")
        : generateBlankUniversalCsv();
      filename = "universal-product-template.csv";
    } else if (type === "essential") {
      const templatePath = join(
        process.cwd(),
        "public",
        "templates",
        "essential-product-template.csv",
      );
      csvData = existsSync(templatePath)
        ? readFileSync(templatePath, "utf8")
        : generateBlankEssentialCsv();
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
    let filePath = "";
    let filename = "";

    if (type === "master") {
      filePath = join(
        process.cwd(),
        "public",
        "templates",
        "aheed-food-centre-master-stock-export.xlsx",
      );
      filename = `aheed-food-centre-master-stock-export.xlsx`;
    } else if (type === "stock") {
      filePath = join(process.cwd(), "public", "templates", "aheed-food-centre-stock-export.xlsx");
      filename = `stock-export-${dateStr}.xlsx`;
    } else if (type === "universal") {
      filePath = join(process.cwd(), "public", "templates", "universal-product-template.xlsx");
      filename = "universal-product-template.xlsx";
    } else if (type === "essential") {
      filePath = join(process.cwd(), "public", "templates", "essential-product-template.xlsx");
      filename = "essential-product-template.xlsx";
    } else {
      return new Response("Invalid export type. Allowed: master, stock, universal, essential", {
        status: 400,
      });
    }

    if (!existsSync(filePath)) {
      return new Response("Export file not found. Run generation script first.", { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  return new Response("Invalid format: must be 'csv' or 'xlsx'", { status: 400 });
}
