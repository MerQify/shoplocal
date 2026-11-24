# Validation: Staff Products Sidebar Filters & Contextual Sticky Action Toolbar

## Verification Criteria
1. **Layout & Space Efficiency**:
   - The product table begins within ~200px of the viewport top, bringing products above the fold on desktop.
   - Filter dropdowns are housed in a dedicated left sidebar (`lg:w-72`).
   - Global low-stock threshold is cleanly relocated to an admin popover without taking up horizontal/vertical card space.
2. **Contextual Sticky Action Toolbar**:
   - The toolbar is hidden when zero products are selected and zero quantities modified.
   - The toolbar displays as a fixed floating bar at the bottom of the screen when ≥ 1 product is checked or a quantity edited.
   - All bulk operations (Move to Active, Move to Archived, change restrictions, set quantities, save quantities) execute reliably.
3. **Responsive Degradation**:
   - On screens `< 1024px`, the sidebar gracefully collapses into an accessible mobile drawer/panel.
   - The table scrolls horizontally on small screens without breaking layout.
4. **Automated Test Coverage**:
   - All regression suites pass: `tests/staff-products-brand-low-stock.test.ts`, `tests/staff-products-query.test.ts`, `tests/staff-products-sidebar-layout.test.ts`, `tests/catalogue-facets-metadata.test.ts`.
   - Quality gates pass: `kms:validate`, `typecheck`, `format:check`, `test`.
