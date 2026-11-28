---
id: image-prompt-gaps
title: "Image prompts: close the gaps left by #1777/#1779 (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-28
visibility: internal
summary: "Unplaced products no longer get 'no food'; bundle and banner prompts get the rewording and domain guardrails; heads are allowed for head products and whole fish; poultry/offal/bird/goat rewording, idempotent sanitiser; the 8007 retry never doubles a prompt."
tags: [workers-ai, prompt-safety, image-generation, p10]
related: ["#1781", "#1779", "#1777", "#1535"]
---

# Image prompts: close the gaps left by #1777/#1779 (plan)

Closes **#1781**. The owner approved the fix on 2026-11-28 ("fix them for me"), after a review of
the staging prompts ran against real category and product names.

## Approach

All changes are in pure, DB-free code, and no exported signature breaks.

1. **General guardrails without "no food".** Add `GENERAL_PROMPT_GUARDRAILS` and use it for the
   `general` domain. `NON_FOOD_PROMPT_GUARDRAILS` stays for electronics, household and beauty.
   Widen `FOOD_PATTERN` with generic staples and plurals, and use it for the category check.
   Add electronics and household aisle words (lighting, connectivity, home & living, kitchen & foil).
2. **Bundles and banners.** `buildBundleImagePrompt` and `buildPromotionBannerPrompt` sanitise the
   bundle name, the item names, the banner subject and the headline. They detect the domain from
   what is pictured and take that domain's guardrails, so "appetising" is used only for food. The
   staff routes call these builders, so they pick the change up without edits. Alt text keeps the
   raw names.
3. **Heads.** `goodsIncludeHead(subject)` covers head products and whole fish.
   `foodGuardrailsFor(subject)` drops "no heads" only for those, and
   `getDomainPhotographyDetails(domain, subject?)` passes the subject through.
4. **Rewording.**
   - **New rules:** chicken wings, legs, feet and offal; whole birds and bird-only names (quail,
     duck, poussin, turkey…); goat → goat meat.
   - **Narrowed:** drumsticks (chicken or turkey only), niblets (chicken only), and cocktail (fruit
     and prawn cocktail become food).
   - **Idempotent:** a second pass changes nothing, using lookbehind where an output could match
     again.
5. **8007 retry.** Retry only when sanitising changes the prompt. Drop the
   `buildProductStudioPrompt(prompt)` fallback.

## Files

- `lib/ai-image-prompts.ts`, `lib/image-generation.ts`
- `tests/image-prompt-gaps.test.ts` (new); expectations updated in
  `tests/bundle-promotion-images.test.ts` and `tests/visual-identity-standards.test.ts`
- `CHANGELOG.md` and this folder

## Not changed

- No schema, UI or route changes. `AI_ART_DIRECTION_STANDARDS` and `applyArtDirectionGuardrails`
  stay as they are (they're tested standards from #1602).
