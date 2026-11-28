# Image prompts: close the gaps left by #1777/#1779 (validation)

Validated in session, for **#1781**. This was not an independent context: the owner skips the
pre-validation `/clear` below roughly 60% context.

| Req | Evidence | Result |
|---|---|---|
| R1 | `image-prompt-gaps.test.ts`, "no 'no food' on food products": 8 food cases, plus non-food aisles staying non-food | Pass |
| R2 | "bundles and banners get the product treatment"; the route test in `bundle-promotion-images.test.ts` asserts no raw "medium chicken" | Pass |
| R3 | "heads are allowed when the goods include one" | Pass |
| R4 | "rewording beyond chicken breasts and thighs": 9 rewordings, 5 left alone, cocktail, and 10 idempotency cases | Pass |
| R5 | "8007 retry only when rewording helps": no resend when unchanged; one retry, prompt not doubled | Pass |
| R6 | `image-prompt-safety`, `product-image-pipeline`, `bundle-promotion-images`, `visual-identity-standards`, `campaign-image-prompt-route`, `category-image-generation` and `ai-image-routes-budget` suites | Pass (116/116) |

**Still to check on staging after merge:** generate one product photo for each of Toor Dal, Lamb
Head, Whole Quail and a SriMart lamp; generate one bundle photo (BBQ Chicken Feast) and one banner.
Look for live animals, a "no food" mismatch or text in the images.

### #1783 follow-up

| Req | Evidence | Result |
|---|---|---|
| R7 | `image-prompt-gaps.test.ts`, "'baby' never survives next to meat": 3 rewordings, each idempotent; the real product's prompt has no "baby"; 3 produce names left alone | Pass |
| R8 | "explains a refusal in plain words rather than dumping the API body" | Pass |
| R9 | "builds a category fallback prompt with no product name in it"; "falls back to the category prompt when the product wording is refused" (the real Baby Chicken prompt); "tries the reworded prompt before the category prompt, and stops at the first success" | Pass |

**Still to check on staging after merge:** regenerate the AI photo for "Baby Chicken" on
`staging.aheedfoodcentre.co.uk`.
