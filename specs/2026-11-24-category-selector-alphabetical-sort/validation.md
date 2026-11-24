# Validation: Category Selector Alphabetical Sorting & Staff Category Collation

## Automated Tests
- `npm test tests/catalogue-form.test.ts`: Verifies default alphabetical sorting of parent optgroups and child options in `toCategoryOptionGroups`, plus `{ sortAlphabetical: false }` input order preservation.
- `npm test tests/image-library-client.test.tsx`: Verifies non-flaky rejection flow under transition.
- `npm run typecheck`: Validates full project types.
- `npm run kms:validate` & `npm run kms:check-generated`: Validates KMS schema compliance and generated artifacts.

## Acceptance Matrix
| Requirement | Validation Method | Result |
|-------------|-------------------|--------|
| R1 (Parent optgroup A–Z) | `tests/catalogue-form.test.ts` | Verified |
| R2 (Child options A–Z) | `tests/catalogue-form.test.ts` | Verified |
| R3 (Opt-out option) | `tests/catalogue-form.test.ts` | Verified |
| R4 (Inherited in pickers) | Static review of call sites | Verified |
| R5 (Staff categories A–Z) | `app/(admin)/staff/categories/page.tsx` | Verified |
