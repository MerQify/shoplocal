# Proprietary licence for the public ShopLocal repository (requirements / acceptance criteria)

Adds an all-rights-reserved licence so the public repository states it is not open source
(`plan.md`, issue #1773).

R1. `LICENSE` exists at the repository root, names the copyright holder ("Srikanth Gedela, trading
    as MerQify"), reserves all rights, permits only viewing on GitHub, and carves out third-party
    dependencies and client-owned material.
R2. `package.json` has `"license": "UNLICENSED"` and keeps `"private": true`.
R3. `README.md` has a "Licence" section linking to `LICENSE`.
R4. `kms:validate`, `kms:coverage` and `kms:check-generated` pass.
R5. `CHANGELOG.md` updated (Gate 4).
R6. `lint`, `typecheck`, `test`, `format:check` all remain green after this slice (CI is
    authoritative for typecheck and test in this worktree; see build notes).
