# Validation: Staff Product Edit 2-Column Responsive Layout & Sticky Low-Stock Alert

## Verification Steps

### 1. Test Suite Verification
Run Vitest on all affected suites:
```bash
npx vitest run tests/page-container.test.ts tests/staff-products-sidebar-layout.test.ts tests/catalogue-form.test.ts
```
Expected: All tests pass with 0 failures.

### 2. Static Analysis & Linter Gates
```bash
npm run typecheck
npm run lint
npm run format:check
npm run icons:check
```
Expected: All checks exit 0 with clean output.

### 3. KMS Governance Gate
```bash
npm run kms:build-index
npm run kms:validate
npm run kms:check-coverage
```
Expected: Front-matter validation, artifact indices, and coverage ratchets pass.

### 4. Visual & Functional Acceptance Criteria
1. **Sticky Floating Action Bar**:
   - `Low-stock alert at:` input is present with current store default.
   - Clicking `Save default` triggers `saveLowStockDefaultAction` and displays confirmation notice.
2. **Product Drilldown (`/staff/products/[id]`)**:
   - Prominent `← Back to products` button is visible at the top left.
   - Desktop layout features 2 columns (`lg:col-span-8` main, `lg:col-span-4` sidebar).
   - Mobile layout (<1024px) stacks into a single column.
   - Submitting the form from either the sidebar `Save changes` button or the bottom button saves all fields (including visibility checkboxes) successfully.
