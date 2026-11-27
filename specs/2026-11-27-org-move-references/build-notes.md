# Repository references after the move to MerQify/shoplocal (build notes)

Issue #1771. Built 2026-11-27 in worktree `E:\GitRepositories\aheed-wt-audit`, branch
`feature/1771-org-move-references`, from `staging` at `4774d0d4`.

## What was done

- One scoped `perl` substitution over the ten files named in `plan.md`, Image Hub's name first so
  `sriahead/merqify-image-hub` never became `MerQify/shoplocal-image-hub`:
  `sriahead/merqify-image-hub` → `MerQify/image-hub`, `sriahead/aheed-online-store` and
  `sriahead/merqify` → `MerQify/shoplocal`. 18 lines changed; `git diff --numstat` checked.
- `operator-runbook.md` gained the repository-home bullet (R3) just above "THIS REPOSITORY IS
  PUBLIC" in "Branch strategy and CI — the detail".
- `kms:build-index` regenerated `ARTIFACT_INDEX.md` and `app/(admin)/staff/runbook/docs.ts`.

## Findings

- **Nothing in `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.claude/` or `.github/` named the old
  repository**, and no workflow names an owner, so CI needed no change and the transfer could not
  break it. The board commands' `--owner sriahead` stays correct: Project #2 did not move.
- **Local typecheck is not evidence in this worktree.** Its root `node_modules` is a junction to the
  main checkout, whose uncommitted dependency and schema changes give 357 errors on **unmodified
  `staging`** — and exactly 357 with this slice, none in a touched file. CI's clean install is the
  check that counts for typecheck and tests here (see the worktree junction note in
  `local-dev-playbook.md`).
