# Validation

| Req | How to verify |
| --- | --- |
| R1 | Inspect the signed-out, unsaved and saved controls on a product card. Verify the outline or fill, computed target size, accessible name and signed-in pressed state. |
| R2 | At 360 and 768 CSS px, open the empty and filled basket, compare the glyph size and label visibility, and verify count, subtotal, empty illustration, Escape and return focus. |
| R3 | Compare computed glyph and target sizes on a product card and in the basket. Use the named increment and decrement controls and verify the displayed quantity updates. |
| R4 | Review a shopping list with an unavailable item and open checkout with timed slots. Verify the parcel with cross, calendar with clock and shield with check appear beside their labels. |
| R5 | Inspect a list-review warning and pending, confirmed and cancelled order results. Verify each glyph suits its message and the status is readable through text. |
| R6 | Run `npm run icons:check`, `npm run lint`, `npm run typecheck` and `npx vitest run`. Check the affected controls for keyboard focus and essential glyph contrast at mobile and desktop widths on Aheed and SriMart. |
