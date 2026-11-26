# Validation — Sticky Action Bar Labels & Visibility

Tracking issue [#1759](https://github.com/sriahead/merqify/issues/1759).

## Verification Criteria

1. **Labels & Visibility Trigger:**
   - Button appears on the sticky bulk action bar when one or more products are checked.
   - Clicking toggles the popover card.

2. **UI Fidelity:**
   - Popover card matches the layout and styling from the user's reference image:
     - "Labels & visibility" title + status badge.
     - "Save changes" primary action button with disk icon.
     - 8 checkboxes: Halal, Fresh, Organic, Vegetarian, Gluten free, Featured on homepage, Visible in the shop, Customers can add a note to this item.

3. **Individual Selection:**
   - When 1 product is checked, the checkboxes load that product's current values.
   - Submitting updates only that product.

4. **Bulk Selection:**
   - When multiple products are checked, submitting updates all selected products.
   - Restricted products are not made visible without clearing restrictions.

5. **Automated Quality Checks:**
   - `npm run lint` passes.
   - `npm run format:check` passes.
   - `npm run typecheck` passes.
   - All new and existing unit tests pass.
