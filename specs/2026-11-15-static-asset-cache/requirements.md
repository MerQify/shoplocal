# Cache hashed static assets for a year (requirements / acceptance criteria)

Closes `#1624`. Content-hashed `/_next/static/*` files are served cacheable for a year, and
personalised pages stay `no-store`.

R1. `public/_headers` exists and applies
    `Cache-Control: public, max-age=31536000, immutable` to `/_next/static/*`, and to no other path.

R2. **AFC staging, live, after deploy.** A `/_next/static/…js` file and a `/_next/static/…css`
    file linked from `/categories` both return `cache-control: public, max-age=31536000, immutable`.

R3. **AFC staging, live.** `/categories` still returns a `cache-control` containing `no-store`.

R4. **AFC staging, live.** `GET /_headers` does not return the file's contents (status 404).

R5. `CHANGELOG.md` updated (Gate 4).

R6. `npm run lint`, `npm run format:check` and `npm run kms:validate` exit 0. CI is green.
