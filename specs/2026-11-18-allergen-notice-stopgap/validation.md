# Allergen notice stopgap (validation)

One additive column, one checkbox, one presentational component on three pages. The migration is
the only infrastructure-adjacent part; CI applies it to staging on merge.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Review | Read `prisma/migrations/20261118120000_vendor_allergen_notice/migration.sql`: one `ADD COLUMN "showAllergenNotice" BOOLEAN NOT NULL DEFAULT false`. |
| R2  | Unit | `npm run typecheck` exits 0 (the field is non-optional on `VendorProfile`). |
| R3  | Unit | `npx vitest run tests/catalogue-settings-form.test.ts` — "allergen notice" case passes. |
| R4  | E2E (staging) | Log in as a demo store admin on staging; `/staff/storefront` shows the checkbox; tick, save, reload, still ticked. |
| R5  | Unit | `npx vitest run tests/allergen-notice.test.tsx` — component cases pass. |
| R6  | Unit | Same file — `/cart` gate cases pass. |
| R7  | E2E (staging) | With the setting on, a product page and `/checkout` show the notice; with it off, neither does. |
| R8  | Review | `git grep -n -i "aheed\|01908" components/product/AllergenNotice.tsx` prints nothing. |
| R9  | Review | `docs/store-admin-guide/admin-tabs-guide.md` contains "Show allergen notice". |
| R10 | Review | `CHANGELOG.md` has a `#1656` entry. |
| R11 | CI | PR checks green. |
