# Explicit Domain Commercial Photography Prompts & Anti-Live-Animal Guardrails (requirements)

Closes **#1779**.

## Context & Problem Statement

Following initial sanitization in #1777, generation requests for "Baby Chicken" still generated living farm chickens standing on cutting boards or dressed carcasses with living heads.
Two core defects caused this:
1. `buildProductStudioPrompt` omitted `IMAGE_PROMPT_GUARDRAILS` (no negative constraint prohibiting live animals or living birds).
2. The model was prompted with `"cornish game hens on butcher block"`: "cornish game hens" is a recognized live bird breed, and "on butcher block" instructed the model to place birds on a board.
3. The prompt lacked explicit domain photography directives (e.g. "Commercial food photography" for food/groceries vs "Commercial electronic goods photography" for electronics/appliances).

## Requirements

### R1. Commercial Photography Domain Detection (`lib/ai-image-prompts.ts`)
- `detectPhotographyDomain(categoryName?: string | null, description?: string | null, productName?: string | null): PhotographyDomain` must classify products into:
  - `"food"`: Meat, poultry, butchery, halal, produce, bakery, dairy, groceries, drinks, etc.
  - `"electronics"`: Electronics, electrical goods, appliances, gadgets, tech, usb, chargers, batteries, cables, etc.
  - `"household"`: Cleaning, detergent, laundry, tableware, cookware, homeware.
  - `"beauty"`: Health, beauty, cosmetics, skincare, haircare, personal care, pharmacy.
  - `"general"`: Any other product or unidentified domain.

### R2. Domain Photography Prefixes & Guardrails (`lib/ai-image-prompts.ts`)
- `getDomainPhotographyDetails(domain: PhotographyDomain)` must supply:
  - Food: `"Commercial food photography of"` + `FOOD_PROMPT_GUARDRAILS`
  - Electronics: `"Commercial electronic goods photography of"` + `NON_FOOD_PROMPT_GUARDRAILS`
  - Household: `"Commercial household goods photography of"` + `NON_FOOD_PROMPT_GUARDRAILS`
  - Beauty: `"Commercial health and beauty product photography of"` + `NON_FOOD_PROMPT_GUARDRAILS`
  - General: `"Commercial studio product photography of"` + `NON_FOOD_PROMPT_GUARDRAILS`
- Food guardrails must strictly exclude live animals, living birds, feathers, heads, people, hands, and require food raw or prepared ready to cook or retail packed.

### R3. Dressed Culinary Cut Sanitization (`lib/ai-image-prompts.ts`)
- `sanitizePromptForSafety` must map butchery cuts to explicit dressed culinary cuts ready to cook:
  - `baby chicken` &rarr; `fresh raw dressed whole baby poultry ready to cook`
  - `medium chicken` &rarr; `fresh raw dressed whole roasting poultry ready to cook`
  - `hard chicken` &rarr; `fresh raw dressed whole stewing poultry ready to cook`
  - `chicken breasts` &rarr; `fresh raw poultry fillets ready to cook`
  - `chicken thighs` &rarr; `fresh raw boneless poultry cutlets ready to cook`
  - `chicken drumsticks` &rarr; `fresh raw poultry drumsticks ready to cook`
- Must remove `"on butcher block"` / `"on wooden board"` keywords.

### R4. Product Studio Prompt Composition (`lib/ai-image-prompts.ts`)
- `buildProductStudioPrompt(productName: string, categoryName?: string | null, description?: string | null): string` must compose:
  `${prefix} ${safeName}${categoryPart}, clean plain white background, professional commercial lighting, crisp focus, centered, 4k. ${guardrails}`
- Always includes domain-specific negative constraints.

### R5. Pipeline & CLI Integration
- `lib/product-image-pipeline.ts` `PipelineOptions` must support optional `categoryName` and `description`.
- `scripts/generate-product-images-ai.ts` must pass `categoryName` and `description` to `buildProductStudioPrompt`.

### R6. Test Coverage (`tests/image-prompt-safety.test.ts`)
- Unit tests must verify:
  1. Domain detection across all 5 domains.
  2. Butchery cut sanitization to dressed ready-to-cook cuts without live-bird triggers.
  3. Composed studio prompts carrying domain prefixes and anti-live-animal guardrails.
