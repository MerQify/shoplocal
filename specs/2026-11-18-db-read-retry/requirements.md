# Retry database reads on a dropped connection (requirements / acceptance criteria)

Closes `#1666`. See `plan.md`.

R1. A plain `SELECT` through `getPrisma()`/`getPrismaUncached()` that fails with a connection-level error is retried at most twice and returns the successful result.
R2. `INSERT`/`UPDATE`/`DELETE` (including `… RETURNING`), CTE-led statements and `SELECT … FOR UPDATE/SHARE` are never retried.
R3. A query error (any SQLSTATE outside `08…`, `57P01`, `57P03`, a non-5xx HTTP error, or any other message) is never retried.
R4. Each retry logs exactly one `[db-retry]` line with the attempt and the reason, and never the SQL or its arguments.
R5. `getPrismaWs()` is unchanged.
R6. All four error boundaries pass `retry ?? reset` to Try again.
R7. `CHANGELOG.md` updated; `lint`, `typecheck`, `test`, `format:check` green.
