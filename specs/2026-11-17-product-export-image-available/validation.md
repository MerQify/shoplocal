# Product Export Image Availability Indicator (validation)

Fixes #1649.

## Acceptance Criteria

1. **Schema & Types**:
   - `UNIVERSAL_COLUMNS` includes `"Image Available"`.
   - `ESSENTIAL_COLUMNS` includes `"Image Available"`.
   - `UNIVERSAL_COLUMN_INSTRUCTIONS["Image Available"]` exists with valid instructions.

2. **Image Detection**:
   - A product with no `images` array (or empty array) outputs `"FALSE"`.
   - A product whose only images end with `/main.svg` outputs `"FALSE"`.
   - A product with at least one non-placeholder image outputs `"TRUE"`.

3. **Export Output**:
   - `productToUniversalRow` maps `Image Available` accurately.
   - `productToEssentialRow` maps `Image Available` accurately.
   - Live CSV exports produce the `Image Available` header and correct row values.

4. **Dropdown Validations in Excel**:
   - `UNIVERSAL_DROPDOWN_RULES` and `ESSENTIAL_DROPDOWN_RULES` have `"Image Available": "TRUE,FALSE"`.

5. **Import Compatibility**:
   - Re-importing a CSV/Excel file with `Image Available` passes analysis without errors.

6. **Quality Checks**:
   - `npm run lint` passes.
   - `npm run typecheck` passes.
   - `npm test` passes.
