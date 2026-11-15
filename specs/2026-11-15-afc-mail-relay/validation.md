# AFC mail sent as @aheedfoodcentre.co.uk through a relay Worker (validation)

> **Testing Strategy (Lean 80/20 Model)** — unit tests for the relay contract, the sender policy and
> the fallback; one live send on AFC staging, confirmed in the owner's inbox.

## Validation Steps

| Req | Testing Area | How to verify |
|-----|--------------|---------------|
| R1  | Unit | `npx vitest run tests/mail-relay-worker.test.ts --maxWorkers=4` passes. Read the test: each row of the R1 table is asserted. |
| R2  | Static | Read `workers/mail-relay/wrangler.toml` and confirm it matches R2. |
| R3  | Unit | `npx vitest run tests/email-policy-relay.test.ts --maxWorkers=4` passes, covering all three branches. |
| R4  | Unit | `npx vitest run tests/email-relay-adapter.test.ts --maxWorkers=4` passes: 2xx gives sent, 500 gives failed, and a thrown fetch gives failed. |
| R5  | Unit | Same file as R4 (or `tests/email-relay-fallback.test.ts`): a relay failure leads to a second delivery through the binding, with the platform From and the store Reply-To. |
| R6  | Unit | Same file: without `EMAIL_RELAY_TOKEN`, the sender resolves to the platform sender and the relay is never called. |
| R7  | Read | Read `lib/client-setup-service.ts` and the client-setup page. The relay domains are passed in, and the label is `(verified, via relay)`. |
| R8  | Static | `grep -n "EMAIL_RELAY" wrangler.toml` shows exactly the four lines, under `afc-staging` and `afc-production`. |
| R9  | E2E (live, owner) | On `staging.aheedfoodcentre.co.uk/staff/platform/client-setup`, "Mail goes out as" shows `info@aheedfoodcentre.co.uk`, and **Send test email** says Sent. The owner confirms the From address and SPF/DKIM/DMARC PASS in Gmail's "Show original". |
| R10 | Read | The env-setup keys table and the relay section exist. |
| R11 | Static | `git diff --name-only origin/staging...HEAD \| grep -x CHANGELOG.md` prints `CHANGELOG.md`. |
| R12 | Gates | The local commands exit 0, apart from the known `#1599` files. PR checks are green. |
