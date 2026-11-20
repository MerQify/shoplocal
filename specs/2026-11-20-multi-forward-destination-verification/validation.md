# Validation Criteria: Multi-Forward & Destination Verification (#1680)

## Automated Tests

1. `tests/email-destinations.test.ts`:
   - `createDestinationAddress` dispatches POST with correct Authorization header and JSON body.
   - Handles `success: true` response.
   - Handles `code 10001` or duplicate address gracefully (`already-exists`).
   - Handles `401/403` gracefully (`forbidden`).
   - Handles network timeout/exception gracefully (`error`).

2. `tests/inbound-email-worker.test.ts`:
   - Worker forwards to multiple recipients when `forwardTo` contains comma-separated addresses.
   - Worker continues forwarding to remaining recipients if one destination throws an error.

3. `tests/client-setup-email-forms.test.tsx` & `tests/client-setup-inbound-groups.test.ts`:
   - Grouping logic handles single and multiple forward-to recipients.
   - Forward targets verified helper handles multi-recipient strings.
   - Server action refuses unverified forward targets.

## Lint & Typecheck
- `npm run lint` passes with 0 warnings.
- `npm run typecheck` passes with 0 errors.
