# Storefront Landing Hero LCP and Accessibility Optimization (requirements)

R1. In `components/layout/PromotionHero.tsx`, the active promotion slide (`index === 0`) must render its image with `fetchPriority="high"` and `loading="eager"`.
R2. In `components/layout/PromotionHero.tsx`, inactive promotion slides (`index > 0`) must render their images with `loading="lazy"` so that React 19 does not preload offscreen banners into document `<head>`.
R3. In `components/layout/PromotionHero.tsx`, carousel rotation and indicator controls must be positioned outside the slide items track so hidden slides (`aria-hidden="true"`) never contain focusable `<button>` elements.
R4. In `components/layout/PromotionHero.tsx`, indicator buttons must satisfy minimum touch target guidelines with at least `24px` by `24px` interactive area.
R5. In `app/(landing)/page.tsx`, the trust value headers under "Shop by department" must use `<h3>` rather than `<h4>` to preserve sequentially-descending heading hierarchy.
R6. In `components/layout/Header.tsx`, the phone link's `aria-label` must contain the visible phone number to satisfy WCAG 2.5.3 (Label in Name).
R7. In `app/(landing)/layout.tsx`, the Schema.org `GroceryStore` JSON-LD structured data must be injected into the root homepage layout so local business schema is present on the primary domain landing page.
R8. Unit tests in `tests/perf-and-a11y-landing.test.ts` must assert and verify each requirement.
