# Image prompts: close the gaps left by #1777/#1779 (build notes)

Built for **#1781** in worktree `E:\GitRepositories\aheed-wt-1781`, on branch
`fix/1781-image-prompt-gaps`, from `origin/staging` at `3629da97`.

- `lib/ai-image-prompts.ts`:
  - **Domain detection:** `GENERAL_PROMPT_GUARDRAILS`, a wider `FOOD_PATTERN` (also used for the
    category check), and `ELECTRONICS_CATEGORY_PATTERN`. Lamp, LED, router and Wi-Fi are added to
    the electronics product words; home & living, candles and foil to household.
  - **Heads:** `goodsIncludeHead` and `foodGuardrailsFor`. `getDomainPhotographyDetails` takes an
    optional `subject`.
  - **Bundles and banners:** both builders now sanitise, detect the domain and take that domain's
    guardrails and finish.
  - **Sanitiser:** new rules, narrowed drumsticks, niblets and cocktail, and lookbehinds that make
    it idempotent. The category name is sanitised in the product prompt too.
- `lib/image-generation.ts`: retry only when sanitising changes the prompt.
- **Tests:**
  - `tests/image-prompt-gaps.test.ts` is new and covers each gap with the real names.
  - Three expectations changed by design (R2): the bundle and banner prompts now carry food
    guardrails and reworded items, in `bundle-promotion-images.test.ts` (prompt and route) and
    `visual-identity-standards.test.ts`.
- **Real-name check:** the 29 category/product pairs from the review all now place correctly
  (scratch script, not committed).
- **Local runs:** the 8 test files that touch the prompt modules gave 116/116, and `eslint` and
  `prettier` were clean on the changed files. As before, the full typecheck runs in CI: a local
  typecheck in this worktree reports pre-existing errors on clean staging.
