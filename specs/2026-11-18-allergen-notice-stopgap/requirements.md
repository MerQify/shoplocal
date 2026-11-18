# Allergen notice stopgap (requirements / acceptance criteria)

Closes `#1656`: a per-vendor setting that shows an "ask us about allergens" notice on product,
basket and checkout pages, as a stopgap ahead of `#1653`. See `plan.md`.

R1. `prisma/schema.prisma` `VendorConfig` has `showAllergenNotice Boolean @default(false)`, and
    migration `20261118120000_vendor_allergen_notice/migration.sql` adds exactly that column.
R2. `getCurrentVendorProfile()`'s `VendorProfile` exposes `showAllergenNotice` (false when the vendor
    has no config row).
R3. `parseCatalogueSettings` returns `showAllergenNotice: true` exactly when the raw value is `"on"`;
    `updateCatalogueSettings` reads the `showAllergenNotice` checkbox and saves it.
R4. `/staff/storefront`'s catalogue-settings form has a "Show allergen notice" checkbox reflecting the
    stored value.
R5. `AllergenNotice` renders "Allergy information" and "ask us about allergens before you order",
    links a diallable phone (`tel:`) and a valid email (`mailto:`), and links nothing otherwise.
R6. `/cart` with lines renders the notice when `showAllergenNotice` is true and does not when false.
R7. The product page and `/checkout` render the notice only when `showAllergenNotice` is true.
R8. No vendor name, phone number or trade example is written into the component or pages.
R9. The store-admin guide documents the setting.
R10. `CHANGELOG.md` updated (Gate 4).
R11. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
