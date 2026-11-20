# Validation: Receiving Addresses Dual Listbox Transfer Picker & Inline Edit

## Test Suite Execution
- `npm run test -- tests/client-setup.test.ts`: verify service layer updates.
- `npm run test -- tests/inbound-address-repo.test.ts` / new tests: verify repository `updateInboundAddress`.
- `npm run test -- tests/client-setup-email-forms.test.tsx`: verify dual listbox rendering, edit mode toggling, and action submissions.
- `npm run test`: run entire project test suite.
- `npm run typecheck`: verify TypeScript compilation with no errors.
- `npm run lint`: verify ESLint passing.
- `npm run kms:coverage`: verify KMS ratchet compliance.
