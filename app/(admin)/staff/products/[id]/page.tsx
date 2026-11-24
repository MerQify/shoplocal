import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireVendorRole } from "@/lib/auth-rbac";
import { getEnv } from "@/lib/config";
import { composePublicUrl } from "@/lib/storage";
import { getProductForAdmin } from "@/lib/products-service";
import { listCategoriesForAdmin } from "@/lib/categories-service";
import { getBrandRepository } from "@/lib/brands-service";
import { PanelRefusal } from "@/components/staff/PanelRefusal";
import { ProductForm } from "@/components/staff/ProductForm";
import { isImageLibraryConfigured } from "@/lib/image-hub-service";
import { productContextQuery } from "@/lib/image-hub/product-context";
import { fetchVendorProfile } from "@/lib/vendor-service";
import { labelSettingsFromProfile } from "@/lib/product-label-settings";
import { listAttributeDefinitions } from "@/lib/attributes-service";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProductRestrictionPanel } from "@/components/staff/ProductRestrictionPanel";
import { listRestrictionAudit } from "@/lib/product-restrictions-service";
import { actorFromVia, RESTRICTION_LABELS } from "@/lib/product-restriction";
import { ProductAllergenForm } from "@/components/staff/ProductAllergenForm";
import { getProductAllergenEditorData } from "@/lib/product-allergen-service";
import { Icon } from "@/components/icons/Icon";
import { formatPrice } from "@/components/product/format-price";

// Reads the session and one live product — must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit product" };

/**
 * Edit a product (P6b1, #159).
 *
 * KEYED ON id, NOT slug. This slice makes a slug editable for the first time,
 * and an admin URL that changes when you rename the thing it points at breaks
 * every bookmark and back button. /staff/orders/{orderNumber} keys on an
 * immutable number for the same reason.
 *
 * getProductForAdmin() is vendor-scoped, so another vendor's product id is
 * indistinguishable from one that doesn't exist: both are notFound().
 *
 * Public image URLs are composed HERE, not in the form. composePublicUrl lives
 * beside the aws4fetch client in lib/storage, so a "use client" component
 * importing it would drag the signer into the browser bundle.
 */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireVendorRole("STAFF", "ADMIN");
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login");
    return (
      <PanelRefusal
        title="Store admins only"
        message="You're signed in, but your account doesn't have permission to manage this store's catalogue."
      />
    );
  }

  const [product, categories, brands, profile, attributes, audit, allergens] = await Promise.all([
    getProductForAdmin(auth.vendorId, id),
    listCategoriesForAdmin(auth.vendorId),
    getBrandRepository().listSummaries(),
    fetchVendorProfile(auth.vendorId),
    listAttributeDefinitions(auth.vendorId),
    // #1211 — vendor-scoped, so another vendor's id returns nothing (and notFound() below fires).
    listRestrictionAudit(auth.vendorId, id),
    getProductAllergenEditorData(auth.vendorId, id),
  ]);
  if (!product) notFound();

  // #1678 — the library picker's starting search, from data this page already holds.
  const imageLibrary = {
    configured: await isImageLibraryConfigured(),
    contextQuery: productContextQuery({
      name: product.name,
      brandName: brands.find((brand) => brand.id === product.brandId)?.name,
      categoryName: categories.find((category) => category.id === product.categoryId)?.name,
    }),
  };

  const cdnBaseUrl = getEnv().CDN_BASE_URL ?? "";
  const imageUrls = product.images.map((image) => ({
    id: image.id,
    url: composePublicUrl(cdnBaseUrl, image.storageKey),
    alt: image.alt,
    isPrimary: image.isPrimary,
    source: image.source,
  }));

  const tracked = product.stockMode === "TRACKED";

  return (
    <PageContainer width="wide" className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/staff/products"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3.5 py-2 text-xs font-bold text-primary shadow-sm transition hover:bg-surface-muted active:scale-95 motion-reduce:active:scale-100"
            aria-label="Back to products catalogue"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            <span>Back to products</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-xs text-primary-muted">
            <Link href="/staff/products" className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span className="font-semibold text-primary truncate max-w-xs">{product.name}</span>
          </div>
        </div>

        {/* Quick status & metrics badge group */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              product.restriction
                ? "bg-amber-100 text-amber-800"
                : product.isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-surface-muted text-primary-muted"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                product.restriction
                  ? "bg-amber-500"
                  : product.isActive
                    ? "bg-emerald-500"
                    : "bg-black/30"
              }`}
            />
            {product.restriction === "AGE_RESTRICTED"
              ? "Age Restricted"
              : product.restriction
                ? RESTRICTION_LABELS[product.restriction]
                : product.isActive
                  ? "Active in shop"
                  : "Hidden / Archived"}
          </span>

          <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-primary">
            {formatPrice(product.basePrice)}
          </span>

          <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-primary-muted">
            {tracked ? `${product.quantity} in stock` : product.stockMode}
          </span>
        </div>
      </div>

      {/* Main Heading and Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-1 text-sm text-primary-muted">
          Changes apply to the shop immediately. Past orders keep the price they were charged.
        </p>
      </div>

      {/* Responsive 2-Column Product Form Layout */}
      <ProductForm
        product={product}
        categories={categories}
        brands={brands}
        labels={labelSettingsFromProfile(profile)}
        attributes={attributes}
        imageUrls={imageUrls}
        imageLibrary={imageLibrary}
        restrictionPanel={
          <div className="space-y-6">
            <ProductAllergenForm
              productId={product.id}
              barcode={allergens?.barcode ?? null}
              saved={allergens?.allergenDeclaration ?? null}
            />
            <ProductRestrictionPanel
              productId={product.id}
              restriction={product.restriction}
              actor={actorFromVia(auth.via)}
              audit={audit}
            />
          </div>
        }
      />
    </PageContainer>
  );
}
