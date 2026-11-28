---
id: explicit-photography-prompts
title: "Explicit Domain Commercial Photography Prompts & Anti-Live-Animal Guardrails (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-28
visibility: internal
summary: "Explicitly steers AI image generation with domain photography styles (food photography, electronic goods photography, etc.) based on category, description, and product name, and enforces anti-live-animal guardrails with ready-to-cook dressed poultry cuts."
tags: [image-hub, workers-ai, prompt-safety, butchery, p10]
related: ["#1779", "#1777", "#1701"]
---

# Explicit Domain Commercial Photography Prompts & Anti-Live-Animal Guardrails (plan)

Closes **#1779**.

## Goal

Ensure AI-generated images for products (especially butchery cuts such as "Baby Chicken") produce realistic commercial product photos ready to cook, eliminating diffuse model tendencies to picture live farm animals on cutting boards, while maintaining multi-tenant vendor neutrality by tailoring photography prefixes ("Commercial food photography", "Commercial electronic goods photography", etc.) based on category and description.

## Approach

1. **Domain Detection (`detectPhotographyDomain`)**:
   - Classify product into `food`, `electronics`, `household`, `beauty`, or `general` based on category name, product description, and product name.
2. **Domain-Specific Photography Directives & Guardrails (`getDomainPhotographyDetails`)**:
   - Food: `"Commercial food photography of..."` with `FOOD_PROMPT_GUARDRAILS` enforcing `"fresh food raw or prepared and ready to cook, packaged groceries in retail packs. No live animals, strictly no living birds, no feathers, no heads, no people, no hands"`.
   - Electronics: `"Commercial electronic goods photography of..."` with `NON_FOOD_PROMPT_GUARDRAILS`.
   - Household: `"Commercial household goods photography of..."`.
   - Beauty: `"Commercial health and beauty product photography of..."`.
   - General: `"Commercial studio product photography of..."`.
3. **Culinary Dressed Cut Sanitization (`sanitizePromptForSafety`)**:
   - Replace sensitive butchery cuts with dressed cuts ready to cook (e.g., `"baby chicken"` &rarr; `"fresh raw dressed whole baby poultry ready to cook"`, `"medium chicken"` &rarr; `"fresh raw dressed whole roasting poultry ready to cook"`).
   - Strip triggers like `"cornish game hens"` and `"on butcher block"` / `"on a wooden board"` which prompted diffusion models to place living birds on chopping boards.
4. **Pipeline & Script Integration**:
   - Update `lib/product-image-pipeline.ts` `PipelineOptions` to accept `categoryName` and `description`.
   - Update `scripts/generate-product-images-ai.ts` to pass category and description to `buildProductStudioPrompt`.
5. **Validation & Verification**:
   - Vitest unit tests covering domain detection, prompt composition, guardrails, and pipeline integration.
