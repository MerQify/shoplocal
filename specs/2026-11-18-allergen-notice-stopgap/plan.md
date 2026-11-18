---
id: 2026-11-18-allergen-notice-stopgap
title: "Allergen notice stopgap — per-vendor 'ask us about allergens' notice (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-18
visibility: internal
summary: Adds a per-vendor "Show allergen notice" setting that signposts shoppers to ask the store about allergens on product, basket and checkout pages, as a go-live stopgap until structured allergen data lands (#1656, ahead of #1653).
tags: [storefront, allergens, compliance, vendor-config, p10]
---

# Allergen notice stopgap (plan)

AFC product pages carry no allergen information (trust audit 2026-11-18). Structured allergen
data is `#1653` and needs a schema design plus the owner collecting data per product, so it cannot
land before go-live. FSA guidance allows allergen information for non-prepacked food sold at a
distance to be given by phone, provided the website clearly signposts how to get it before the
order. This slice is that signpost. The owner approved it as the stopgap and chose an explicit
per-vendor setting over inferring "sells food" from the dietary-label toggles (2026-11-18).

**Goal:** a food vendor can switch on a notice that appears on every product page, the basket and
checkout, telling shoppers to ask about allergens before ordering, with the vendor's own contacts.
A non-food vendor (SriMart) sees no change.

**Scope (this slice):**
- `VendorConfig.showAllergenNotice Boolean @default(false)`; hand-authored migration
  `20261118120000_vendor_allergen_notice` (`#895`).
- Read through `lib/repositories/vendor.ts` (`VendorProfile.showAllergenNotice`) and written
  through `updateVendorStorefrontConfig`.
- Owned by the existing catalogue-settings form in `/staff/storefront`
  (`lib/catalogue-settings-form.ts`, `features/admin/storefront.ts` `updateCatalogueSettings`,
  `components/staff/StorefrontConfigForm.tsx`) as a checkbox outside the product-label fieldset.
- `components/product/AllergenNotice.tsx` — vendor-neutral copy; phone and email from the vendor's
  footer contact fields, linked only when `isDiallablePhone`/`isEmailAddress` pass.
- Rendered when the setting is on: product page (under Add to cart), `/cart` (when it has lines),
  `/checkout` (under the heading).
- Store-admin guide (`docs/store-admin-guide/admin-tabs-guide.md`) documents the setting.

**Deliberately excluded:**
- Structured allergen/ingredients data, product editor and import changes — `#1653`.
- Turning the setting on for Aheed. That is the owner's action in `/staff/storefront` on each AFC
  environment after deploy; a data migration naming one vendor would hard-code a tenant.
- Provisioning manifests (`scripts/provision-vendor.ts`): the column defaults to false, so a new
  vendor gets the safe value without a manifest field.
