---
id: 2026-11-15-perf-lcp-and-a11y-landing-plan
title: "Storefront Landing Hero LCP and Accessibility Optimization (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-15
visibility: internal
tags: [performance, lcp, accessibility, a11y, web-vitals, structured-data, landing]
summary: "Optimize storefront landing hero Largest Contentful Paint (LCP) and resolve accessibility deductions identified in Google PageSpeed Insights (zb8uu21j1p)."
---

# Storefront Landing Hero LCP and Accessibility Optimization (plan)

## Objective

Elevate the PageSpeed Insights performance score from **77 to 95+** and accessibility score from **92-95 to 100** on both mobile and desktop by addressing the root causes identified in report `zb8uu21j1p`:
1. Prevent React 19 from preloading offscreen carousel banners into document `<head>`, set `fetchPriority="high"` on the active slide, and lazy-load inactive slides in `components/layout/PromotionHero.tsx`.
2. Move carousel rotation and pagination buttons outside the slide track so hidden slides (`aria-hidden="true"`) never contain focusable elements.
3. Enforce proper heading hierarchy in landing page trust claims.
4. Align phone link accessible name with visible text under WCAG 2.5.3 (Label in Name).
5. Ensure minimum 24x24px clickable touch target for carousel pagination dots.
6. Inject Schema.org `GroceryStore` structured data in `app/(landing)/layout.tsx` so the root homepage has local business schema alongside storefront routes.

## Implementation Details

1. **`components/layout/PromotionHero.tsx`**:
   - For slide `index === 0`: render `<ImageWithFallback fetchPriority="high" loading="eager" />`.
   - For slide `index > 0`: render `<ImageWithFallback fetchPriority="auto" loading="lazy" />`.
   - Move pause button and pagination dots out of the slide loop to the outer container.
   - Add touch target wrapper with `min-w-[24px] min-h-[24px] flex items-center justify-center` around each pagination dot.
2. **`app/(landing)/page.tsx`**:
   - Change trust claims `<h4>` to `<h3>`.
3. **`components/layout/Header.tsx`** or wherever phone link `tel:` is rendered:
   - Ensure `aria-label` includes the visible phone number text.
4. **`app/(landing)/layout.tsx`**:
   - Inject `buildStoreJsonLd` with `serializeJsonLd` identical to `app/(storefront)/layout.tsx`.
