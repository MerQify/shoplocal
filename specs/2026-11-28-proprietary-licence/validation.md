# Proprietary licence for the public ShopLocal repository (validation)

Low risk: no runtime code changes.

| Req | Check | Result (2026-11-28, same session as build) |
| --- | --- | --- |
| R1 | Read `LICENSE` | pass |
| R2 | `grep '"license": "UNLICENSED"' package.json` and `"private": true` kept | pass |
| R3 | `README.md` "Licence" section links `LICENSE` | pass |
| R4 | `kms:validate`, `kms:coverage` (baseline matches), `kms:check-generated` | pass |
| R5 | `CHANGELOG.md` entry naming #1773 | pass |
| R6 | local `lint`, `format:check` pass; typecheck and test on PR CI | see PR checks |
