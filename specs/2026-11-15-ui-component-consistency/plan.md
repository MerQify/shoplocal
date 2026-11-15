---
id: 2026-11-15-ui-component-consistency-plan
title: "Website-Wide UI Component Standards and Visual Consistency Optimisation (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-15
visibility: internal
tags: [design-system, components, tokens, ui-consistency, cro, accessibility]
summary: "Establish comprehensive design and implementation standards for UI components across Aheed Food Centre, including component sizing tokens, unified 4px spacing scale, standardized Button/Badge primitives, Card variant consolidation, and accessibility guarantees."
---

# Website-Wide UI Component Standards & Visual Consistency Optimisation (plan)

Closes **#1608**.

## 1. Problem Statement & Audit Findings

An audit of 261 TSX components and pages across Aheed Food Centre revealed opportunities to consolidate styling and establish uniform component sizing:
1. **Button Heights & Padding**: 159 button instances use 15+ different padding combinations (`px-4 py-2`, `px-3 py-1.5`, `px-5 py-2.5`, `px-4 py-3`, etc.). While `Button.tsx` exists, it currently defines only two variants (`action` and `primary`) without standard size steps.
2. **Badge & Tag Fragmentations**: 88 badge instances across products, orders, and promotions use 10+ ad-hoc class strings with slight padding and font-size variations (`px-2.5 py-0.5 text-xs`, `px-2 py-0.5 text-[10px]`, `px-3 py-1`, `px-2.5 py-1`). No canonical `Badge.tsx` primitive exists in `components/ui/`.
3. **Card Primitive Duplication**: `BundleCard.tsx` duplicates the 117-character card styling string from `ProductCard.tsx` instead of composing the shared `Card` primitive (`variant="product"`).
4. **Spacing System**: Sections, component gaps, and card padding use mixed Tailwind utilities. Codifying the 4px spacing scale and standard control heights (32px, 40px, 44px, 48px) ensures visual balance across desktop, tablet, and mobile.

## 2. Technical Architecture & Solutions

### A. Design Tokens (`design-system/tokens/components.json`)
A structured JSON schema defining:
- **Control Heights**: `sm` (32px), `md` (40px, default), `lg` (48px), `tap` (44px mobile touch target).
- **Spacing Scale (4px base grid)**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- **Card Padding**: `compact` (14px, `p-3.5`), `standard` (16px, `p-4`), `panel` (20px, `p-5`), `spacious` (24px, `p-6`).
- **Badge Sizes**: `sm` (18px height), `md` (22px height).
- **Shape & Radii**: Strict alignment with `tests/radius-scale.test.ts` (`rounded-xl` for controls, `rounded-2xl` for cards, `rounded-full` for badges/pills).

### B. Reusable `Badge` Primitive (`components/ui/Badge.tsx`)
A zero-JS server component rendering a pill badge:
- **Variants**: `action` (green), `primary` (forest green), `accent` (amber), `danger` (red), `muted` (cream), `outline` (transparent border).
- **Tones**: `fill` (solid background with white text) and `tint` (light semantic tint with high-contrast foreground).
- **Sizes**: `sm` (compact product card overlay) and `md` (standard interface badge).

### C. Standardised `Button` Primitive (`components/ui/Button.tsx`)
Expanding the existing server component:
- **Variants**: `action`, `primary`, `secondary`, `outline`, `danger`, `ghost`.
- **Sizes**: `sm` (32px), `md` (40px, default), `lg` (48px), `tap` (44px).
- **Keyboard focus**: `focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2`.
- Preserves 100% backward compatibility for all existing call sites.

### D. Component Consolidation
- Refactor `components/bundle/BundleCard.tsx` to use `<Card variant="product">`.
- Refactor `components/product/ProductCard.tsx` badges to use consistent sizing rules and token classes.

## 3. Implementation Order

1. **Tokens**: Create `design-system/tokens/components.json` and update `tokens.css`.
2. **Badge Primitive**: Author `components/ui/Badge.tsx`.
3. **Button Primitive**: Expand `components/ui/Button.tsx`.
4. **Card Refactoring**: Update `components/bundle/BundleCard.tsx` to use `Card`.
5. **Documentation**: Update `specs/design-system.md`.
6. **Tests**: Author `tests/ui-component-standards.test.ts`.
7. **Verification**: Run `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run kms:build-index`.
