---
id: ai-image-generation
title: "Merqify Image Hub — phase 2: AI image generation in the gallery (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-20
visibility: internal
summary: "Provides interactive AI product photo generation in /staff/image-library and a batch CLI tool for products lacking images (including inactive products so photos are ready ahead of activation), metered against the vendor's daily AI budget and landing in the hub as PENDING_REVIEW."
tags: [image-hub, workers-ai, ai-meter, p10]
related: ["#1669", "#1671", "#1674", "#1697", "#1701"]
---

# Merqify Image Hub — phase 2: AI image generation in the gallery (plan)

**Goal:** Staff and store admins can generate commercial studio product photography directly from `/staff/image-library` and via a batch CLI tool for products without real photos. This includes **both active and inactive products**, allowing store operators to generate, review, and approve photos in advance so products are immediately ready to sell once activated.

## Why this slice exists

Merqify Image Hub (#1669) creates a unified central image gallery for store catalogues. Phase 1a created the hub service, Phase 1b built the `/staff/image-library` client, Phase 1c (#1674) imported existing store photos, and Phase 3 (#1697) integrated licensed open search (Openverse, Wikimedia Commons, Open Food Facts).

However, many store items—such as custom fresh halal butcher cuts, deli items, or unbranded produce—do not exist in open food databases or stock photography repositories (#1521). Furthermore, stores frequently onboard products in an inactive state before photography is available. Phase 2 introduces on-demand and batch AI image generation using Cloudflare Workers AI (`@cf/black-forest-labs/flux-1-schnell`), metered against the vendor's daily budget, preserving full provenance, and requiring admin approval before assignment.

## Scope (this slice)

1. **Service Layer & Metering (`lib/image-hub-service.ts`):**
   - `generateAiImageForLibrary`:
     - Checks `STAFF` or `ADMIN` vendor role.
     - Checks vendor's daily AI budget via `getVendorAiMeter(vendorId, "PRODUCT_IMAGE")`.
     - Invokes `getImageGenerationService().generateImage(prompt)`.
     - Records neuron consumption in the AI meter ledger.
     - Calls `importAsset` on the Image Hub with `source: "AI_GENERATED"`, `licence: "AI_GENERATED"`, `status: "PENDING_REVIEW"`, `rightsConfirmed: true`.
   - `listProductsForAiPrompt`:
     - Returns vendor products matching a search query, explicitly querying **both `isActive: true` and `isActive: false`** products.

2. **Server Actions (`features/admin/image-library.ts`):**
   - Export `generateAiImageAction(input)` and `listProductsForAiPromptAction(query)`.
   - Revalidates `/staff/image-library` on successful generation.

3. **Staff Panel UI (`components/staff/`):**
   - Create `components/staff/ImageAiGeneratorPanel.tsx` in `/staff/image-library`:
     - Product selector supporting all products (active and inactive, with an "Inactive" badge for clarity).
     - Selecting a product auto-composes an optimized prompt: `"Studio product photograph of [Name], [Category], clean plain white background, professional commercial lighting, crisp focus, centered, 4k"`.
     - Manual prompt customization input.
     - "Generate Photo" button with loading state.
     - Prepend generated asset into the library view on completion.
     - Clear refusal messaging if daily AI budget is exhausted.

4. **Batch Generation CLI (`scripts/generate-product-images-ai.ts`):**
   - Script to batch-generate AI images for catalogue products lacking photos.
   - Includes **both active and inactive** products by default (`--include-inactive`), with optional `--status <active|inactive|all>`.
   - Supports `--limit <n>`, `--env-file <path>`, `--dry-run`, `--apply`.
