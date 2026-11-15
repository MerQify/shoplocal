# AFC mail sent as @aheedfoodcentre.co.uk through a relay Worker (build notes)

Written at the end of Build, before the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

The worktree is `E:\GitRepositories\aheed-wt-1605`, on branch `feature/1627-afc-mail-relay`, cut
from `origin/staging` at `24b998f0`. The owner chose the relay at Propose (2026-11-15).

The owner then completed the prerequisites:
- **Workers Paid** on the Aheed account;
- the token in `secrets/afc-mail-relay.vars`. It was verified active for account "Aheed Food Centre",
  with workers.dev subdomain `aheed-food-centre-f85`.

## What changed and why

- **`workers/mail-relay/`** holds the Worker (`src/index.ts`) and its `wrangler.toml`.
  - It exposes only `POST /send`, behind a constant-time bearer-token check (`safeEqual`).
  - `ALLOWED_FROM_DOMAINS` caps who it can send as.
  - It logs no recipient, subject or body.
  - `workers_dev = true` gives its URL; it has no route and no zone.
- **`lib/config.ts`.**
  - New optional `EMAIL_RELAY_URL`, `EMAIL_RELAY_TOKEN` and `EMAIL_RELAY_DOMAINS`.
  - New `activeRelayDomains(env)`, which returns the domains only when both URL and token are set
    (R6).
- **`lib/email/policy.ts`.** `resolveSender` gains `relayDomains`, and returns `via: "relay"` for
  them. A verified domain still wins.
- **`lib/email/relay.ts`.** A new adapter that POSTs to `<url>/send` and never throws.
- **`lib/email.ts`.** A `via: "relay"` message goes through the relay. If that fails, it is re-sent
  through the normal adapter with `from = {store name, EMAIL_FROM}` and `replyTo` = the caller's
  override or the store email.
- **Client Setup.** `lib/client-setup-service.ts` and `app/(admin)/staff/platform/client-setup/page.tsx`
  gain `relayDomains` on the platform status and `senderDomainViaRelay` on the section data. The
  label reads "(verified, via relay)". `senderDomainVerified` now counts relay domains too, so the
  Client Setup checklist step reads Done.
- **`wrangler.toml`.** `EMAIL_RELAY_URL` / `EMAIL_RELAY_DOMAINS` added to the AFC staging and
  production vars only.
- **Docs.** `docs/developer-portal/env-setup.md` gets the keys rows, a corrected
  `EMAIL_VERIFIED_DOMAINS` row (same-account caveat), and an "AFC mail relay" section.
- **Tests.** New `tests/mail-relay-worker.test.ts` (11 tests, R1) and `tests/email-relay.test.ts`
  (R3–R6).

## Decisions taken during the build

- **One relay serves both staging and production.** Staging subjects are already tagged
  `[STAGING]` by the app, and the one domain cap applies to both. Two relays would double the manual
  deploys for no isolation gain.
- **Relay URL and domains are committed vars; only the token is a secret.** A misconfigured URL is
  visible in review, while the token never is.
- **The fallback reuses the normal adapter** rather than a second code path, so the platform-sender
  behaviour is exactly today's.

## Deviations from the spec

- `validation.md` originally named three test files. The implementation uses one,
  `tests/email-relay.test.ts`, with "R3", "R4" and "R5/R6" blocks. The rows were updated to match
  before commit.

## Known-shaky areas

- **Not live yet.** The relay is not deployed, and the token is not set, until the owner runs the
  setup script. Auto mode refuses secret writes and deploys into another account. R9 is the only
  real proof.
- **Unproven assumption: the Aheed account accepts the `send_email` binding.** That depends on
  Workers Paid there. If `wrangler deploy` errors on the binding, the plan is wrong for that
  account.
- **Cross-account fetch.** The app Worker fetches a `*.workers.dev` URL in another account. That is
  ordinary public HTTPS, but it is not yet exercised.
