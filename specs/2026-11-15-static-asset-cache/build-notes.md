# Cache hashed static assets for a year (build notes)

Written at the end of Build, before the Clear. This is the one artifact the Clear bets on: the
validating context is fresh and has only the spec, the artifact, and this file.

The worktree is `E:\GitRepositories\aheed-wt-1605`, on branch `feature/1624-static-asset-cache`,
cut from `origin/staging` at `aab4c16d`. The owner asked for the caching check, and for production
to be updated, on 2026-11-15.

## What changed and why

- **New `public/_headers`** with a single rule: `/_next/static/*` →
  `Cache-Control: public, max-age=31536000, immutable`.
- **Evidence before the change.** With the zone set to Respect Existing Headers, a cache-busted
  (`MISS`) JS request on both AFC hosts still returned `public, max-age=14400, must-revalidate`.
  So the header was the Worker assets' own, and only a repo change can fix it.

## Decisions taken during the build

- **Only `/_next/static/*` is covered.** Files directly under `public/` (for example
  `/images/icons-3d/…`) are not content-hashed, so a long immutable cache could pin an old version
  after a file is replaced in place. They keep the default.

## Deviations from the spec

None.

## Known-shaky areas

- **The build step is not checked locally.** That OpenNext copies `public/_headers` into
  `.open-next/assets`, and that Workers Static Assets honours it, rests on the documented behaviour.
  No local OpenNext build was run, so R2 on staging is the proof. If R2 fails, check that
  `.open-next/assets/_headers` exists in the build output.
