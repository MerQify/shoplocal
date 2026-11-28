# Explicit Domain Commercial Photography Prompts & Anti-Live-Animal Guardrails (validation)

Built for **#1779**.

## Test Validation Results

- **`tests/image-prompt-safety.test.ts`**:
  - `detectPhotographyDomain`:
    - Food domain detection: Halal Meat & Poultry, Baby Chicken, Basmati Rice, Milk, Bakery, Drinks.
    - Electronics domain detection: Electric Goods, Smart Watch, USB charger, AA Batteries in Groceries, Cables.
    - Household and Health/Beauty domain detection: Cleaners, face creams, shampoos.
    - General domain fallback: Office binder.
  - `sanitizePromptForSafety`:
    - Butchery cut sanitization to dressed ready-to-cook cuts:
      - `Halal Chicken Breasts 1kg` &rarr; `Halal fresh raw poultry fillets ready to cook 1kg`
      - `Baby Chicken Whole` &rarr; `fresh raw dressed whole baby poultry ready to cook Whole`
      - `Fresh Chicken Thighs 500g` &rarr; `Fresh fresh raw boneless poultry cutlets ready to cook 500g`
      - `Chicken Drumsticks Pack` &rarr; `fresh raw poultry drumsticks ready to cook Pack`
      - `Cocktail Sausages 400g` &rarr; `bite-size party sausages 400g`
      - `Beef Butt Steak` &rarr; `Beef shoulder roast Steak`
    - Preservation of non-butchery grocery items and non-food items.
  - `buildProductStudioPrompt`:
    - Verified prefix `"Commercial food photography of fresh raw dressed whole baby poultry ready to cook, Halal Poultry"`.
    - Verified guardrail `"No live animals, strictly no living birds, no feathers, no heads, no people, no hands"`.
    - Verified absence of live bird breed triggers (`cornish game hens`) and butcher board triggers.
    - Verified electronics prefix `"Commercial electronic goods photography of..."`.
    - Verified general prefix `"Commercial studio product photography of..."`.
  - Automatic retry recovery on 400 code 8007 errors verified.
- **`tests/product-image-pipeline.test.ts`**:
  - 11/11 tests passed, verifying prompt construction with dressed cuts.
- **`tests/bundle-promotion-images.test.ts`**:
  - 18/18 tests passed.
- **`tests/visual-identity-standards.test.ts`**:
  - 12/12 tests passed.
