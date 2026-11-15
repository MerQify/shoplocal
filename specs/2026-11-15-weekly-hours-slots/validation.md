# Weekly opening hours control checkout slots (validation)

> **Testing Strategy (Lean 80/20 Model)** — unit tests for the rules and the two enforcement points,
> and one live check on AFC staging.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/slot-closure.test.ts --maxWorkers=4` passes. Read the `effectiveDayHours` tests: dated wins; weekly closed gives `Closed every Wednesday`; weekly times give changed hours; neither gives `null`. |
| R2  | Unit | Same file: a weekly-closed weekday returns `[]` for both methods, and `closedLabel` is `Closed every …`. |
| R3  | Unit | Same file: weekly `09:00–19:00` drops COLLECTION `18:00–20:00` and keeps DELIVERY `18:00–20:00`. |
| R4  | Unit | Same file: a dated open entry on a weekly-closed day offers collection inside the dated hours; a dated closed entry on an open day offers none. |
| R5  | Unit | Same file, `placeOrder` block: a weekly-closed day gives `STORE_CLOSED` and no create; COLLECTION outside the weekly hours gives `SLOT_CLOSED`. |
| R6  | Unit / component | `npx vitest run tests/place-order-express-closure.test.ts tests/slot-picker-grid.test.tsx --maxWorkers=4` passes, including the weekly-hours Express cases. |
| R7  | E2E (live) | On AFC staging (Wednesday weekly **Closed all day**, as the owner left it), add a product and open `/checkout`. **Pass:** the Wednesday column shows `Closed` / `Closed every Wednesday` with no radio under either method, and Click & Collect has no Sunday `18:00 - 20:00` slot while Delivery has one. |
| R8  | Docs (read) | Read the Opening hours text in `docs/store-admin-guide/admin-tabs-guide.md`. It states both rules and the dated-entry precedence. |
| R9  | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`, and the entry cites `#1615`. |
| R10 | Gates | lint, typecheck, format:check and kms:validate exit 0. Full vitest with `--maxWorkers=4` passes apart from the four `#1599` live-DB files. CI is green. |
