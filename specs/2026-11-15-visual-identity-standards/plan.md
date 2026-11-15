---
id: 2026-11-15-visual-identity-standards-plan
title: "Visual Identity Standards, Icon System, and AI Visual Art Direction (plan)"
audience: [dev]
type: spec
status: approved
version: "1.0.0"
updated: 2026-11-15
visibility: internal
tags: [design-system, icons, visual-assets, art-direction, cro, ai-generation, tokens]
summary: "Establish a cohesive, professional and conversion-conscious visual identity across Aheed Food Centre by standardising icon specifications into 3 families, creating reusable icon design tokens, codifying strict AI art direction guardrails, and applying CRO principles."
---

# Visual Identity Standards, Icon System, and AI Visual Art Direction (plan)

Closes **#1602**.

## 1. Problem Statement & Audit Findings

Aheed Food Centre's visual assets currently span multiple sources and visual styles:
1. **Functional interface icons**: Sharp, minimalist Lucide monochrome vector strokes (`components/icons/registry.ts`).
2. **Category and status icons**: Colourful Google Noto Emoji (`provider: "noto"`), introducing bright cartoon-style elements that can clash with clean corporate lines.
3. **Department illustrations**: 16 flat multi-colour SVG files (`public/illustrations/departments/`).
4. **Category photos**: 16 photography JPEG files (`public/images/categories/`).
5. **3D icons**: 14 commercial 3D icons (`public/images/icons-3d/`) rendered inside `IconMedallion`.
6. **Promotional hero banners & AI images**: Generated via Flux / Llama (`lib/promotions-ai.ts`, `lib/ai-image-prompts.ts`), which previously risked showing live animals instead of cuts of meat, distorted hands, or text drawn inside the image canvas.

To build consumer trust, enhance brand equity, and increase conversion rates, the visual identity must be unified under clear standards:
- **Functional family**: Search, basket, account, navigation, checkout. Clean 1.5px monochrome SVG on 24x24 grid.
- **Category family**: Meat, poultry, seafood, groceries, vegetables, bakery, dairy. Recognisable silhouettes, balanced within medallions.
- **Promotional family**: Offers, bundles, savings, delivery, rewards, trust badges. Tinted medallions, high visual salience without cognitive clutter.

## 2. Technical Architecture & Design Standards

### A. Icon Design Specifications
- **Base Grid**: 24 × 24px bounding box.
- **Stroke Weight**: 1.5px starting point for clean, elegant lines.
- **Safe Area**: 2px internal padding (20 × 20px active drawing area) to prevent clipping.
- **Corner Treatment & Caps**: Rounded caps (`stroke-linecap="round"`) and joins (`stroke-linejoin="round"`), 2px corner radius.
- **Scaling Steps**: 16px (`sm`), 20px (`md`), 24px (`lg` default), 32px (`xl`), 48px (`2xl`).
- **Colours**: Semantic tokens (`text-primary`, `text-action`, `text-accent`, `text-danger`, `text-primary-muted`, `currentColor`).
- **Format**: Scalable Vector Graphics (SVG).

### B. AI Visual Art Direction Standards
- **Realism & Quality**: Natural, realistic, commercially appropriate food photography. Halal cuts of meat raw or prepared ready-to-cook, fresh produce, authentic grocery packaging.
- **Strict Negative Constraints**: No live animals, no humans, no hands, no distorted textures, no floating text, no lettering, no badges, no watermarks, no price tags.
- **Lighting & Perspective**: Warm, soft studio daylight; natural contact shadows; 3/4 camera perspective; clean neutral backgrounds (slate, light stone, natural wood).
- **Banner Composition**: Wide 16:9 banner with generous left-side negative space (empty background) for UI text overlay, keeping the primary subject anchored on the right.

### C. Semantic Colours & Accessibility
- **Primary Brand**: `#1B5E20` (Forest Green) for brand identity, headers, wordmark.
- **Action**: `#2E7D32` (WCAG AA 5.13:1 on white) for primary purchasing actions, Add to Basket, Checkout.
- **Accent**: `#A85400` (WCAG AA 5.34:1 on white) for urgent badges, savings highlights, reward accents.
- **Danger**: `#C82D2D` (WCAG AA 4.75:1 on danger tint) for error alerts and limited-time urgency.
- **Surfaces**: `#F5F5F0` (Surface Muted) and `#FFFFFF` (Surface Elevated).

### D. Consumer Psychology & Conversion Rate Optimisation (CRO)
- **Cognitive Fluency**: Familiar, immediately recognisable iconography reduces cognitive friction during product discovery.
- **Visual Hierarchy**: Strong visual cues guide customer attention from hero offer -> category browse -> product card -> primary CTA.
- **Halo Effect**: Consistent, premium food photography reinforces consumer confidence in freshness, halal compliance, and hygiene.
- **Value Framing**: Savings and bundle discounts framed with transparent savings (`Save £X.XX` or `X for £Y`).
- **Visual Salience**: Reserving accent colors (`#A85400`) and high-contrast action buttons (`#2E7D32`) ensures critical conversion cues stand out without overwhelming the shopper.

## 3. Implementation Steps

1. Update `components/icons/types.ts`:
   - Add `IconFamily` type (`functional`, `category`, `promotional`).
   - Add specification constants: `ICON_BASE_GRID`, `ICON_STROKE_WEIGHT`, `ICON_SAFE_AREA_PX`, `ICON_CORNER_RADIUS_PX`, `ICON_LINE_CAP`, `ICON_LINE_JOIN`, `ICON_SCALE_STEPS`.
   - Add `ICON_FAMILY_MAP` mapping every registered icon key to its family.
2. Create `design-system/tokens/icons.json` defining the formal design token schema for icons.
3. Update `lib/ai-image-prompts.ts` and `lib/promotions-ai.ts`:
   - Enhance prompt guardrails with commercial food photography rules and banner composition guidelines.
   - Combine generated AI prompts with guardrails before dispatching to image generation.
4. Update `specs/design-system.md` with the icon families, design specifications, AI visual standards, and CRO principles.
5. Author `tests/visual-identity-standards.test.ts` to test all rules and assertions.
6. Create markdown artifact summarizing the visual audit and guidelines for stakeholders.
7. Run validation tools (`kms:validate`, `kms:build-index`, `lint`, `typecheck`, `test`), update `CHANGELOG.md`, and open PR into `staging`.
