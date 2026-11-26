# Validation: Category Sorting (Icon sortOrder vs Text Alphabetical) and Dual Top/Bottom Pagination

## Automated Tests
- `npm test tests/category-visibility.test.ts`: Verifies `listTopLevelCategories` preserves database `sortOrder` instead of overriding with alphabetical collation.
- `npm test tests/catalogue-form.test.ts`: Verifies text option groups and selectors sort alphabetically by default.
- `npm test tests/pagination.test.tsx`: Verifies that all 6 paginated pages render both top and bottom instances of `<Pagination>`.
- `npm run typecheck`: Validates full project types.
- `npm run lint`: Validates ESLint rules.
- `npm run kms:validate` & `npm run kms:check-generated`: Validates KMS schema compliance.

## Acceptance Matrix
| Requirement | Validation Method | Result |
|-------------|-------------------|--------|
| R1 (Icon category sortOrder) | `tests/category-visibility.test.ts` | Pass |
| R2 (Text/list alphabetical) | `tests/catalogue-form.test.ts` + `tests/list-sorting.test.ts` | Pass |
| R3 (Dual pagination top/bottom) | `tests/pagination.test.tsx` | Pass |
| R4 (Staff tables dual pagination) | Static inspection & `tests/pagination.test.tsx` | Pass |
| R5 (Storefront lists dual pagination) | Static inspection & `tests/pagination.test.tsx` | Pass |
| R6 (Position prop & aria/ids) | `tests/pagination.test.tsx` | Pass |
