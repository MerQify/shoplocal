# Cache hashed static assets for a year (validation)

> **Testing Strategy (Lean 80/20 Model)** — a config file; prove it by reading the live response
> headers after deploy.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Static | Read `public/_headers`. **Pass:** one rule, `/_next/static/*`, setting `Cache-Control: public, max-age=31536000, immutable`. |
| R2  | E2E (live) | Fetch `https://staging.aheedfoodcentre.co.uk/categories` and take the first `/_next/static/…js` and `…css` URLs from the HTML. Fetch each with a cache-busting query. **Pass:** both `cache-control` headers equal `public, max-age=31536000, immutable`. |
| R3  | E2E (live) | `cache-control` on `/categories` contains `no-store`. |
| R4  | E2E (live) | `GET https://staging.aheedfoodcentre.co.uk/_headers` returns 404. |
| R5  | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`. |
| R6  | Gates | lint, format:check and kms:validate exit 0. PR checks are green. |
