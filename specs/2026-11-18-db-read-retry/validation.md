# Retry database reads on a dropped connection (validation)

| Req   | Testing Area      | How to verify                                                                                                                        |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1–R4 | Unit              | `npx vitest run tests/db-read-retry.test.ts`                                                                                         |
| R1    | Integration       | A real `PrismaClient` on Neon HTTP with one injected `Network connection lost.` returns the row after one retry (done 2026-11-18 on AFC staging, read-only). |
| R3    | Integration       | Against dev with stale credentials, `password authentication failed` propagated without retry (2026-11-18).                         |
| R5    | Review            | `git diff lib/db.ts` touches only the two HTTP factories.                                                                           |
| R6    | Review            | `git grep "retry ?? reset" app` lists four files.                                                                                    |
| R7    | CI                | PR checks green.                                                                                                                     |
| —     | E2E (post-merge)  | AFC staging Worker logs show `[db-retry]` lines where a read recovered, and no 500 for the same request.                            |
