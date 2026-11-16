# Validation — R2 storage immutable cache header and AI image WebP pipeline

Closes **#1630**.

| Item | Kind | Target | Expected Result |
| :--- | :--- | :--- | :--- |
| **V1** | Unit | `tests/storage.test.ts` | `putObject` passes `"cache-control": "public, max-age=31536000, immutable"` in fetch headers. |
| **V2** | Unit | `tests/storage.test.ts` | `presignPut` includes `"cache-control": "public, max-age=31536000, immutable"` in signed headers. |
| **V3** | Unit | `tests/promotions-banner.test.ts` / `tests/bundle-promotion-images.test.ts` | AI banner generation workflow correctly generates and uploads valid `.webp` image assets. |
| **V4** | Quality | `npm run lint` | Exits 0 with zero ESLint errors or warnings. |
| **V5** | Quality | `npm run typecheck` | Exits 0 with zero TypeScript errors. |
| **V6** | Quality | `npx vitest run` | All unit and integration test suites pass. |
| **V7** | KMS | `npm run kms:validate` | All documentation frontmatter and indices validated. |
