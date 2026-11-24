# Validation: Staff Products Filter Dropdown Widths & Layout Stability

## Verification Criteria
1. **Dropdown Width Determinism**:
   - Each of the 8 filter dropdowns has an explicit fixed width class (`w-36`, `w-56`, `w-44`, `w-40`, `w-40`, `w-44`, `w-44`, `w-24`) and `shrink-0`.
   - Selecting "Active", "Archived", or specific categories does not alter the width of any dropdown.
   - Filter items do not shuffle between 1-row and 2-row layouts when the contents change.
2. **Text Presentation**:
   - Long selected names truncate gracefully with ellipsis inside the closed `<select>` via `w-full truncate`.
   - The native select popup menu displays full untruncated option labels upon clicking.
3. **Automated Test Coverage**:
   - `tests/staff-products-filter-widths.test.ts` passes and asserts on all 8 dropdown width bounds.
   - KMS validation, typecheck, format, and unit tests all pass with 0 errors.
