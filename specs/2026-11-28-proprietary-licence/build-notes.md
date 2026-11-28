# Proprietary licence for the public ShopLocal repository (build notes)

Issue #1773. Built 2026-11-28 in worktree `E:\GitRepositories\aheed-wt-audit`, branch
`feature/licence-proprietary`, from `staging` at `723d59ce`.

- `LICENSE` written as a plain all-rights-reserved notice in five numbered clauses (viewing,
  permission needed for everything else, third-party components, client material, no warranty).
  GitHub's licence detector reports such files as "Other" / no SPDX id, which is the intended
  signal that the code is not open source.
- `package.json` gained `"license": "UNLICENSED"` beside `"private": true`.
- `README.md` gained a "Licence" section. The README's "Current state: Milestone 0" text is long
  out of date; not touched here (out of scope).
- `kms:coverage` matched its baseline: a root `LICENSE` without front-matter is not a new directory.
- **Local tests could not run:** vitest's fork pool fails to start in this worktree
  (`options.minThreads and options.maxThreads must not conflict`), whose root `node_modules` is a
  junction to the main checkout with uncommitted dependency changes. CI's clean install is
  authoritative for typecheck and test (as in #1771).
