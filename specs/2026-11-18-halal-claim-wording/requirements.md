# Halal claim wording (requirements / acceptance criteria)

Closes `#1658`. See `plan.md`.

R1. The homepage renders no HMC pill when the vendor's `showHalalLabel` or `showHmcCertification` is
    false.
R2. With both true, the homepage pill reads "HMC certified halal", and no "100%" text renders.
R3. A product page for an `isHalal` product without `isHmcCertified` shows "Halal" and makes no
    certification claim; with `isHmcCertified` it shows "HMC certified halal".
R4. No "100% Certified HMC Halal" or "100% Halal Verified" literal remains in `app/`.
R5. `CHANGELOG.md` updated (Gate 4).
R6. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice.
