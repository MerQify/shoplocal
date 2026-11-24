# Requirements: Staff Products Filter Dropdown Widths & Layout Stability

## Problem Statement
When staff toggle between active, archived, or specific categories on `/staff/products`, the options inside the filter `<select>` elements change dynamically due to cascading metadata. Because the `<select>` elements lacked fixed bounded widths and used auto-sizing based on their option contents, the element widths shrank and expanded depending on the length of the filtered option names. In a flex-wrap container, this caused the controls to shuffle and re-wrap unpredictably across rows (e.g. jumping between a 4-item row and a 7-item row), disorienting the user.

## Requirements
1. **Fixed Optimal Widths**: Each filter dropdown on `/staff/products` must have a defined, fixed optimal width so that changing filter selections never alters the container width or causes dropdowns to shuffle across rows:
   - **Status**: `w-36` (144px) — fits "All products", "Active", "Archived".
   - **Category**: `w-56` (224px) — accommodates department and subcategory titles.
   - **Brand**: `w-44` (176px) — accommodates brand names and "No brand".
   - **Restriction**: `w-40` (160px) — accommodates "Restricted", "Not restricted", and restriction types.
   - **Stock**: `w-40` (160px) — accommodates stock mode options.
   - **Needs attention**: `w-44` (176px) — accommodates worklist labels and "NEEDS ATTENTION" header.
   - **Sort**: `w-44` (176px) — accommodates sorting labels.
   - **Per page**: `w-24` (96px) — accommodates page size counts.
2. **Layout Invariance**: The filter dropdown elements must carry `shrink-0` to prevent flexbox from compressing them when the screen is resized or when option values change.
3. **Clean Closed Truncation**: `<select>` elements must have `w-full truncate` so that selected values that exceed the box width truncate gracefully with ellipsis when closed, while maintaining full visibility in the native dropdown popup when opened.
4. **Action Buttons Stability**: "Apply filters" and "Clear all" must remain aligned and intact without wrapping awkwardly away from the filter group.
