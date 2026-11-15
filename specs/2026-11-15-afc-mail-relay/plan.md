---
id: 2026-11-15-afc-mail-relay-plan
title: "AFC mail sent as @aheedfoodcentre.co.uk through a relay Worker (plan)"
audience: [dev]
type: spec
status: draft
version: "1.0.0"
updated: 2026-11-15
visibility: internal
summary: "#1627. AFC Workers run in the Merqify account but aheedfoodcentre.co.uk is onboarded for sending in the Aheed Food Centre account. A token-guarded relay Worker there sends store mail as the store; the app falls back to the platform sender."
tags: [email, cloudflare, go-live]
related: [sdd-workflow]
---

# AFC mail sent as @aheedfoodcentre.co.uk through a relay Worker (plan)

Issue `#1627`, part of go-live (`#1344`, `#104`).

**What happened.** On 2026-11-15 the production Client Setup test email failed with "email from
aheedfoodcentre.co.uk not allowed because domain is not owned by the same account".
- The AFC Workers (`afc-store-production`/`-staging`) and their `EMAIL` binding run in the
  **Merqify** account.
- `aheedfoodcentre.co.uk` is onboarded for Email Sending in the **Aheed Food Centre** account, where
  its zone lives (DKIM `cf2024-1._domainkey` is published).
- Cloudflare only lets a Worker send from domains onboarded in its own account.

The go-live mitigation was to delete `EMAIL_VERIFIED_DOMAINS`, so mail now goes as
`Aheed Food Centre <no-reply@merqify.com>`. The owner wants mail **from** `info@aheedfoodcentre.co.uk`.

**The owner's decision (Propose, 2026-11-15): a relay Worker in the Aheed account.** The
alternative, moving the zone to Merqify, would mean reworking DNS and Cloudflare for SaaS right
before launch. The owner also turned on Workers Paid for the Aheed account (Email Sending needs it)
and saved an Aheed-scoped token in `secrets/afc-mail-relay.vars`. It is verified: active, account
"Aheed Food Centre".

**Goal:** a store whose sender domain is listed for the relay sends as itself. Nothing is lost when
the relay is unreachable.

## Scope

**1. `workers/mail-relay`, a new Worker named `afc-mail-relay` in the Aheed account.**
- **Config.** `workers_dev = true`, with the URL `https://afc-mail-relay.aheed-food-centre-f85.workers.dev`.
  It has one `[[send_email]] name = "EMAIL"` binding, a `RELAY_TOKEN` secret, and an
  `ALLOWED_FROM_DOMAINS` var (`aheedfoodcentre.co.uk`).
- **The `/send` endpoint.** `POST /send` with `Authorization: Bearer <RELAY_TOKEN>` and a JSON body
  `{ from: {name,email}, to, subject, html, text, replyTo? }`.
- **Responses:**
  - **401:** a missing or wrong token. The comparison is constant-time.
  - **403:** a `from` outside the allowed domains.
  - **400:** a malformed body.
  - **200 `{status:"sent"}`:** the binding sent the message.
  - **502 `{status:"failed",reason}`:** the binding threw.
- It stores and logs no message body.
- **Deploy.** Deployed manually with the Aheed-account token, because CI holds no Aheed credentials.
  The same pattern applies to anything outside the Merqify account.

**2. The app's email port.**
- **Config.** New optional settings:
  - `EMAIL_RELAY_URL` and `EMAIL_RELAY_DOMAINS`: plain vars, committed in `wrangler.toml` for the
    AFC envs;
  - `EMAIL_RELAY_TOKEN`: a Worker secret.
- **Sender resolution** (`lib/email/policy.ts` `resolveSender`) gains `relayDomains`:
  - a sender domain in `EMAIL_VERIFIED_DOMAINS` sends as itself through the binding (unchanged);
  - otherwise, a domain in `EMAIL_RELAY_DOMAINS` (relay configured) sends as itself
    **through the relay**;
  - otherwise, the platform sender with Reply-To the store (unchanged).
- **Delivery.** A new adapter, `lib/email/relay.ts`, POSTs to the relay and never throws. In
  `lib/email.ts`, a relay failure **falls back** to the normal adapter with the platform sender and
  Reply-To the store, and logs both outcomes.
- **Client Setup.** It shows the effective From through the same `resolveSender`. The store domain
  reads "(verified, via relay)".

**3. Config and docs.**
- `wrangler.toml` gets `[env.afc-staging.vars]` / `[env.afc-production.vars]` entries for
  `EMAIL_RELAY_URL` and `EMAIL_RELAY_DOMAINS`.
- `docs/developer-portal/env-setup.md` gets the keys table rows and a short relay section: how to
  deploy it, and how to rotate the token.

## Deliberately excluded

- **Relaying for other stores.** Only AFC needs it. The relay's `ALLOWED_FROM_DOMAINS` caps it to
  one domain.
- **Moving the zone** (`#1342`) and reworking Cloudflare for SaaS.
- **A CI deploy for the relay.** That would need Aheed-account credentials in GitHub, so it stays a
  manual, documented step.

## Owner steps

These need secret writes, which auto mode refuses:
- generate the shared token;
- put it on the relay and on both AFC Workers;
- deploy the relay.

I provide one script that does all of this without printing the token.

**Open items carried forward:** none.
