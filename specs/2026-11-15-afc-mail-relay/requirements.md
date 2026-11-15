# AFC mail sent as @aheedfoodcentre.co.uk through a relay Worker (requirements / acceptance criteria)

Closes `#1627`. Store mail whose sender domain is listed in `EMAIL_RELAY_DOMAINS` is sent as the
store through the `afc-mail-relay` Worker in the Aheed Food Centre account. A relay failure falls
back to the platform sender. `plan.md` has the account constraint and the owner's decision.

## Relay Worker (`workers/mail-relay`)

R1. Unit tests in `tests/mail-relay-worker.test.ts` assert the following, with a fake `EMAIL`
    binding.

    | Request | Response | Binding |
    |---|---|---|
    | Not `POST /send` | 404 | — |
    | No bearer token, or a wrong one | 401 | not called |
    | `from.email` outside `ALLOWED_FROM_DOMAINS` | 403 | not called |
    | Missing `to`/`subject`/`html`, or invalid JSON | 400 | — |
    | Valid request | 200 `{"status":"sent"}` | called once with `from`, `to`, `subject`, `html`, `text`, and `replyTo` when given |
    | Valid request, binding throws | 502 `{"status":"failed","reason":…}` | called once |

R2. `workers/mail-relay/wrangler.toml` declares the following, and no other binding:

    - name `afc-mail-relay`;
    - `workers_dev = true`;
    - one `[[send_email]]` with name `EMAIL`;
    - `ALLOWED_FROM_DOMAINS = "aheedfoodcentre.co.uk"`.

## App email port

R3. `resolveSender` returns:

    - `{ from: store, via: "relay" }` when the sender's domain is in `relayDomains` and not in
      `verifiedDomains`;
    - `{ from: store }` (binding) when the domain is in `verifiedDomains`, whether or not it is
      also a relay domain;
    - `{ from: platform, replyTo: store }` otherwise.

    Unit tests assert all three.

R4. `lib/email/relay.ts` `createRelayAdapter(url, token, fetch)` POSTs JSON to `<url>/send` with
    `Authorization: Bearer <token>`. It returns `sent` on a 2xx response, and `failed` with a reason
    on a non-2xx response or a network error. It never throws. Asserted by unit tests with a fake
    fetch.

R5. In `getEmailService().send`:

    - a message resolved `via: "relay"` is delivered by the relay adapter;
    - if that returns `failed`, the message is re-sent through the normal adapter, with
      `from = platform sender` (name = store name) and `replyTo = store email`;
    - the result is that second attempt's result.

    Both attempts are logged. Asserted by unit tests.

R6. The relay is used only when `EMAIL_RELAY_URL` and `EMAIL_RELAY_TOKEN` are both set. With either
    missing, a relay-domain sender resolves to the platform sender, as today. Asserted by a unit
    test.

R7. Client Setup's effective From uses the same `resolveSender` inputs, relay domains included. The
    store-domain line reads `(verified, via relay)` for a relay domain.

## Config, live, docs

R8. `wrangler.toml` `[env.afc-staging.vars]` and `[env.afc-production.vars]` each set:

    - `EMAIL_RELAY_URL = "https://afc-mail-relay.aheed-food-centre-f85.workers.dev"`
    - `EMAIL_RELAY_DOMAINS = "aheedfoodcentre.co.uk"`

    No other environment sets them.

R9. **AFC staging, live.**

    1. After the owner runs the provided setup script (relay deployed, and the token on the relay
       and both AFC Workers), Client Setup shows "Mail goes out as
       `Aheed Food Centre <info@aheedfoodcentre.co.uk>`".
    2. **Send test email** reports Sent.
    3. The message arrives From `info@aheedfoodcentre.co.uk` with SPF, DKIM and DMARC PASS, checked
       by the owner.

R10. `docs/developer-portal/env-setup.md` lists `EMAIL_RELAY_URL`, `EMAIL_RELAY_DOMAINS` and
     `EMAIL_RELAY_TOKEN`, and has a relay section covering what it is, how to deploy it and how to
     rotate the token.

R11. `CHANGELOG.md` updated (Gate 4).

R12. `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=4` (apart from the four
     `#1599` live-DB files), `npm run format:check` and `npm run kms:validate` are green. CI is
     green.
