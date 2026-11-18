# Storefront trust fixes (validation)

UI copy and visibility only; no database, auth or payment logic changes. Unit/render tests cover
the visibility rules; a staging check confirms the served pages.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/help-vendor-facts.test.tsx` — anonymous render has no `#staff-email`, no "Staff Email Setup", no "App Password". |
| R2  | Unit | Same file — staff (`requireVendorRole` → `{ ok: true, via: "STAFF" }`) render has `#staff-email`. |
| R3  | Unit | `grep -c aheedfoodcentre "app/(storefront)/help/page.tsx"` prints `0`. |
| R4  | Unit | Same test file — single-role render has no `role="tablist"`. |
| R5  | Unit | Same file — anonymous: no "Store Staff"/"Store Admin"/"Platform Admin"; platform-admin render shows all four. |
| R6  | Unit | Same file — `document.getElementById("delivery")` is not null. |
| R7  | Unit | `npx vitest run tests/terms-page.test.tsx` — `#refunds` text matches report/original payment method/14 days/deteriorate. |
| R8  | Unit | Same file — no "Tax Responsibility"; contains "Merqify Ltd" and the vendor name. |
| R9  | Unit | Same file — "Last updated: November 18, 2026". |
| R10 | Unit | Existing vendor-copy guard tests stay green (`npx vitest run --maxWorkers=4`). |
| R11 | Review | `git diff origin/staging -- CHANGELOG.md` shows a `#1652` entry. |
| R12 | CI | PR checks green (quality.yml). |
| —   | E2E (post-merge) | On `staging.aheedfoodcentre.co.uk`, logged out: `/help` has no staff email guide or role tabs; `/terms#refunds` shows the new wording. |
