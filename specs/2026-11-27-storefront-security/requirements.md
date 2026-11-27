# Authentication and staging policy requirements

Tracking issue #1769.

- Enforce five reservations per vendor and source in a rolling minute across simultaneous requests.
- Apply a short account backoff to email login across independent sources without persisting an email address. Preserve existing attempt data and use identical refusal responses for account existence states.
- Apply the script policy trial only to staging hosts and preserve the enforced site policy and staff cache controls.
- Verify using the application database adapter, a disposable PostgreSQL database, and the existing tenant and payment regression suites.
