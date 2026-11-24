# Validation: Staff Products Collapsible Filters & Compact Age Restriction

## Verification Steps

### 1. Test Suite Verification
Run Vitest on all affected suites:
```bash
npx vitest run tests/staff-products-sidebar-layout.test.ts tests/panel-token-purity.test.ts tests/repository-purity.test.ts tests/repository-client-injection.test.ts
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
npm run kms:check-generated
```
Expected: Index regenerated, validation passed, no stale artifacts.

### 4. Functional Acceptance Criteria
1. **Collapsible Sidebar**:
   - Clicking collapse button hides sidebar and expands table across full viewport.
   - Expanding restores sidebar with all active filter selections intact.
   - Preference persists across navigation.
2. **Age Restriction Badge**:
   - "Age Restricted" badge is displayed cleanly under product name.
   - Tooltip displays explanation.
   - Status column is free of bulky banner.
3. **Low-Stock Alert on Selected**:
   - Applying low stock threshold updates only selected products.
   - Top header popover configures store-wide default.
