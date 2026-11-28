# Image prompts: close the gaps left by #1777/#1779 (requirements)

Closes **#1781**.

## Context

#1777 and #1779 (both on staging, not promoted) added domain-directed product prompts and butchery
rewording. A review run against real names found five gaps. One of them, gap 1, is a regression.

## Requirements

- **R1:** No product prompt says "no food" unless the product is detected as electronics,
  household or beauty. Measured cases must be detected as food: Lentils & Pulses / Toor Dal,
  Cooking Oils / Desi Ghee, Breakfast Basics / Weetabix, Nuts & Dried Fruit / Medjool Dates,
  Crisps & Namkeen / Bhujia, and Okra, Plantain and Tahini with no category. Non-food aisles keep
  non-food guardrails: Lighting, Connectivity, Home & Living, Health & Beauty.
- **R2:** Bundle and banner prompts reword names for the safety filter, including every bundle
  item, and carry the guardrails of the detected domain. A raw "Medium Chicken" never reaches the
  model through the bundle route. Only food bundles and banners are called "appetising".
- **R3:** "No heads" is dropped only when the goods include a head (a head product, or a whole
  fish). A whole chicken keeps it.
- **R4:** The sanitiser rewords chicken wings, legs, feet and offal, whole birds and bird-only
  names, and goat. It leaves sweetcorn niblets, moringa drumsticks, goat milk, duck eggs and turkey
  mince alone, and rewords fruit and prawn cocktail as food. It is idempotent.
- **R5:** On an 8007 block, the service retries once with the sanitised prompt, and only if
  sanitising changed it. It never sends a doubled prompt.
- **R6:** Existing behaviour holds: the #1777/#1779 tests pass, with expectations updated only
  where R2 deliberately changes them.
