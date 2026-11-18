# Help content names the store's own website (requirements / acceptance criteria)

Closes `#1662`. See `plan.md`.

R1. The `/help` shopper journey's starting point reads "This store's homepage (<canonicalHost>)." when the vendor has a canonical host, otherwise "This store's homepage.". It never names another storefront.
R2. No `aheed.merqify.com` or `srimart.merqify.com` remains in `docs/client-help-centre/`, `components/help/`, `app/(storefront)/help/` or `lib/vendor-readiness-service.ts`.
R3. `CHANGELOG.md` updated (Gate 4).
R4. `lint`, `typecheck`, `test`, `format:check` remain green.
