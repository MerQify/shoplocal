# Client Setup: Multi-forward receiving addresses & in-dashboard destination verification

Closes #1680. Enables stores to forward incoming customer enquiries to multiple team members simultaneously without Google Groups, and lets platform admins send Cloudflare Email Routing destination verification emails directly from `/staff/platform/client-setup`.

## Requirements & Acceptance Criteria

### Destination Verification API (R1–R3)

R1. `lib/email/destinations.ts` exports `createDestinationAddress(credentials, email, fetchImpl)`:
    - Calls `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/email/routing/addresses` with `{ email: normaliseAddress(email) }`.
    - Returns `{ ok: true, address: DestinationAddress }` when Cloudflare returns `success: true`.
    - Handles status 401/403 as `{ ok: false, reason: "forbidden" }`.
    - Handles duplicate/already registered address as `{ ok: false, reason: "already-exists" }`.
    - Handles other network/HTTP errors as `{ ok: false, reason: "error" }`.
    - Never throws and logs no sensitive tokens.
    - Covered by unit tests with stubbed `fetchImpl` in `tests/email-destinations.test.ts`.

R2. `app/(admin)/staff/platform/client-setup/actions.ts` exports `sendDestinationVerificationAction`:
    - Gated strictly by `requireVendorRole("ADMIN")` with `auth.via === "platform-admin"`.
    - Validates email syntax.
    - Calls `createDestinationAddress` using account credentials from `getEmailEnv()`.
    - Revalidates `/staff/platform/client-setup` on success.

R3. `/staff/platform/client-setup` renders an "Add Team Mailbox" card or form under the Email section:
    - Provides input for email and a "Send verification email" button.
    - Displays feedback: success message when verification email is dispatched by Cloudflare, or error state.

### Multi-Forward Inbound Addresses (R4–R6)

R4. `lib/repositories/inbound-address.ts`:
    - `normaliseForwardToList(forwardTo: string): string`: normalizes comma-separated emails, trims whitespace, deduplicates, and sorts.
    - `createInboundAddress`: validates and stores normalized comma-separated `forwardTo`.

R5. `AddInboundAddressForm` in `components/staff/client-setup/EmailSetupForms.tsx`:
    - Displays a multi-select checklist of verified destination addresses.
    - Allows selecting multiple verified addresses.
    - Unverified addresses are displayed as disabled with "(awaiting verification)" label.
    - Form posts the list of selected verified addresses.
    - Server action `addInboundAddressAction` verifies server-side that at least one verified address is selected.

R6. `groupAddressesByForwardTo` in `lib/client-setup/inbound-groups.ts`:
    - Groups addresses clearly, supporting multiple forward targets per address.

### Inbound Worker Multi-Forward Delivery (R7–R8)

R7. `workers/inbound-email/src/index.ts`:
    - Parses `resolution.forwardTo` into distinct recipient addresses (split on `,`).
    - Loops over all recipients and executes `await message.forward(recipient)` for each.
    - Catches errors per-recipient so a failure on one recipient does not stop delivery to the others.
    - Logs successful delivery count and any recipient delivery errors.

R8. Unit tests in `tests/inbound-email-worker.test.ts`:
    - Verify that when `resolution.forwardTo` contains multiple addresses, `message.forward` is called once per recipient.
    - Verify that if one `forward` rejects, the remaining forwards still execute.
