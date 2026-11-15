# Website-Wide UI Component Standards & Visual Consistency Optimisation (requirements)

Closes **#1608**. Establishes comprehensive, reusable design and implementation standards for all UI components across Aheed Food Centre (`https://staging.aheedfoodcentre.co.uk`), establishing visual consistency, professional proportions, standard control heights, balanced card layouts, unified 4px spacing tokens, and CRO-aligned visual hierarchy.

## 1. Global Component Tokens & Spacing System

R1. Author `design-system/tokens/components.json` codifying standard design tokens:
    - **Control Heights**: `sm: "32px"` (2rem), `md: "40px"` (2.5rem, baseline), `lg: "48px"` (3rem), `tap: "44px"` (2.75rem, minimum touch target).
    - **Spacing Scale (4px base grid)**: `1: "4px"`, `2: "8px"`, `3: "12px"`, `4: "16px"`, `5: "20px"`, `6: "24px"`, `8: "32px"`, `10: "40px"`, `12: "48px"`, `16: "64px"`.
    - **Card Padding**: `compact: "14px"` (`p-3.5` for product/bundle cards), `standard: "16px"` (`p-4`), `panel: "20px"` (`p-5` for admin/account panels), `spacious: "24px"` (`p-6` for modals/drawers).
    - **Badge Dimensions**: `sm: "18px"` (`px-2 py-0.5 text-[10px]`), `md: "22px"` (`px-2.5 py-0.5 text-xs`).
    - **Border Radius**: strict adherence to `tests/radius-scale.test.ts` (controls use `rounded-xl`, cards/panels use `rounded-2xl`, pills/badges/medallions use `rounded-full`).
    - **Typography Scale & Line Heights**: H1 (32px / 36px line-height, bold), H2 (24px / 28px, semibold), H3 (18px / 22px, semibold), Body (14px / 20px, regular), Caption (12px / 16px, regular), Badge (10px / 14px, semibold).

R2. In `design-system/tokens/tokens.css`, expose standard control height utilities and theme variables.

## 2. Reusable Badge Component

R3. Create `components/ui/Badge.tsx`:
    - Pure server component (`"use client"`-free) rendering a semantic `<span className="...">`.
    - Support variants: `"action"` (green), `"primary"` (dark green), `"accent"` (amber), `"danger"` (red), `"muted"` (cream/subtle gray), `"outline"` (bordered).
    - Support tones: `"fill"` (solid vibrant background with white text) and `"tint"` (subtle tinted background with high-contrast foreground text).
    - Support sizes: `"sm"` (compact overlay, 18px height, `text-[10px] px-2 py-0.5`) and `"md"` (standard UI badge, 22px height, `text-xs px-2.5 py-0.5`).
    - Enforce `rounded-full` pill geometry with WCAG AA contrast compliance.

R4. Adopt standard badge styling in `components/product/ProductCard.tsx` and `components/bundle/BundleCard.tsx`.

## 3. Standardised Button Component

R5. Enhance `components/ui/Button.tsx`:
    - Maintain full backward compatibility for `variant="action"` (`buttonClass`) and `variant="primary"` (`PRIMARY_CLASS`).
    - Add extended variants: `"secondary"` (muted surface with subtle border), `"outline"` (transparent with action border), `"danger"` (destructive red), `"ghost"` (clean text button with hover highlight).
    - Add standard size scale: `"sm"` (32px height, `h-8 px-3 text-xs`), `"md"` (40px height, `h-10 px-4 text-sm`, default), `"lg"` (48px height, `h-12 px-5 text-base`), and `"tap"` (44px mobile touch target).
    - Ensure all interactive states have visible keyboard focus rings (`focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2`).

## 4. Card & Surface Consistency

R6. Refactor `components/bundle/BundleCard.tsx` to use `Card variant="product"` rather than duplicating the raw CSS class string.
R7. Ensure cards in repeated grids maintain consistent layout structure with `flex flex-col justify-between h-full` and bottom-anchored action rows.

## 5. Design System Documentation

R8. Update `specs/design-system.md` with:
    - Component Sizing & Control Height Standards (32px, 40px, 44px, 48px).
    - 4px Layout & Spacing System.
    - Component Family Standards (Buttons, Inputs, Cards, Badges, Modals).
    - Consumer Psychology & CRO Guidelines for visual hierarchy and cognitive fluency.

## 6. Automated Verification

R9. Author `tests/ui-component-standards.test.ts` verifying:
    - `components.json` schema integrity and values.
    - `Badge` component variants, sizes, and class generation.
    - `Button` component variants, sizing steps, and backward compatibility.
    - `BundleCard` card component integration.
    - Zero contrast regressions across badge and button token pairs.
