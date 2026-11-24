# Validation: Cascading Catalogue Filters & Cloudflare Metadata Architecture

## Automated Tests
- `npm test tests/catalogue-facets-metadata.test.ts`: Tests facet segmentation, category-to-brand mapping, caching, and cascading logic.
- `npm test tests/cloudflare-metadata.test.ts`: Verifies metadata store operations, cache miss fallback, and cache warming.
- `npm run typecheck`: TypeScript verification across the entire project.
- `npm run kms:validate` & `npm run kms:check-generated`: Verifies KMS index and frontmatter compliance.

## Acceptance Matrix
| Requirement | Validation Method | Result |
|-------------|-------------------|--------|
| R1 (Active status facets) | `tests/catalogue-facets-metadata.test.ts` | Verified |
| R2 (Archived status facets) | `tests/catalogue-facets-metadata.test.ts` | Verified |
| R3 (Category-to-brand cascade) | `tests/catalogue-facets-metadata.test.ts` | Verified |
| R4 (All status fallback) | `tests/catalogue-facets-metadata.test.ts` | Verified |
| R5 (Alphabetical collation) | `toCategoryOptionGroups` & `lib/list-sorting.ts` | Verified |
| R6-R9 (Cloudflare KV & refresh) | `tests/cloudflare-metadata.test.ts` | Verified |
