# Visual Identity Standards, Icon System, and AI Visual Art Direction (requirements)

Closes **#1602**. Establishes a cohesive, professional, and conversion-conscious visual identity for Aheed Food Centre (`https://www.aheedfoodcentre.co.uk`), standardising icon specifications, categorising assets into 3 distinct families, codifying AI art direction guardrails, and enforcing semantic design tokens and CRO principles.

## 1. Icon Design & Families

R1. In `components/icons/types.ts`, define `IconFamily = "functional" | "category" | "promotional"`.
R2. In `components/icons/types.ts`, specify practical and reusable icon design constants:
    - Base grid: `ICON_BASE_GRID = 24` (24 × 24px)
    - Stroke weight: `ICON_STROKE_WEIGHT = 1.5` (1.5px baseline)
    - Safe area: `ICON_SAFE_AREA_PX = 2` (2px internal margin, 20 × 20px active drawing area)
    - Corner radius: `ICON_CORNER_RADIUS_PX = 2` (2px rounded corner treatment)
    - Line caps & joins: `ICON_LINE_CAP = "round"` and `ICON_LINE_JOIN = "round"`
    - Scaling scale: `ICON_SCALE_STEPS = [16, 20, 24, 32] as const`
R3. Every icon in `ICON_REGISTRY` (`components/icons/registry.ts`) must map to exactly one of the three families:
    - **Functional**: navigation controls, search, basket, account controls, chevrons, pagination, toggles, plus/minus, check, close, refresh.
    - **Category**: food departments and grocery categories (meat, poultry, seafood, groceries, vegetables, dairy, bakery, beverages).
    - **Promotional**: offers, bundles, savings, delivery, rewards, trust badges, guarantees, customer care, badges.
R4. Export `ICON_FAMILY_MAP: Record<IconName, IconFamily>` in `components/icons/types.ts` (or `registry.ts`) categorising all registered icons.
R5. Functional icons must use Lucide vector SVG on a 24 × 24 grid with 1.5px stroke and rounded caps.

## 2. Design Tokens & Design System Documentation

R6. Author `design-system/tokens/icons.json` defining the schema and token values for icon families, base grid, stroke weight, safe area padding, scaling steps, line treatments, and semantic tone mapping.
R7. Update `specs/design-system.md` with:
    - The 3 Icon Families and their design rules.
    - Standardised icon design specifications (grid, stroke, safe area, scaling, line caps).
    - AI Visual Art Direction and realistic commercial food photography standards.
    - Brand identity and semantic colours with WCAG AA accessibility contrast compliance.
    - Consumer psychology and CRO principles (cognitive fluency, visual hierarchy, halo effect, value framing, visual salience, conversion cues).

## 3. AI-Generated Image & Art Direction Standards

R8. In `lib/ai-image-prompts.ts`, enhance `IMAGE_PROMPT_GUARDRAILS` with strict art direction constraints:
    - Natural, realistic, commercially appropriate food photography (fresh raw halal cuts or prepared ready-to-cook, fresh produce, authentic pantry packs).
    - Strictly prohibited: live animals, people, distorted hands, artificial glowing food, distorted proportions.
    - Strictly prohibited: embedded text, lettering, logos, watermarks, badges, price stickers.
    - Studio lighting: soft, diffused natural daylight; subtle contact shadows.
    - Composition: clean neutral surfaces (slate, light marble, natural wood, ceramic); shallow depth of field; appealing 3/4 angle.
R9. In `lib/ai-image-prompts.ts`, enforce banner composition rules in `buildPromotionBannerPrompt`:
    - Wide 16:9 aspect ratio.
    - Subject positioned on the right 50% of the canvas.
    - Generous negative space on the left 50% for high-contrast typography overlays.
R10. In `lib/promotions-ai.ts`, enhance `buildPromotionPrompt` to instruct the LLM to write image prompts adhering to realistic food photography standards, 3/4 angle, clean studio lighting, right-aligned focal subject, and left-side negative space.
R11. In `lib/promotions-ai.ts`, ensure generated image prompts are appended with `IMAGE_PROMPT_GUARDRAILS` before dispatching to the image generation service.

## 4. Verification & Testing

R12. Author unit test `tests/visual-identity-standards.test.ts` verifying:
    - All registered icons have a designated `IconFamily` mapping.
    - Icon design constants match the 24x24 grid, 1.5px stroke, 2px safe area, and scaling steps.
    - AI prompt guardrails enforce all required negative rules (no live animals, text, hands) and photography parameters (clean neutral surface, soft studio lighting, 3/4 angle).
    - Promotional banner prompts enforce right-hand subject placement and left-hand negative space.
    - Semantic colour tokens and contrast requirements are respected.
