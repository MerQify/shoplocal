#!/usr/bin/env bash
set -euo pipefail
# #1705 — write the env file image-hub-sync.yml passes to import-images-to-hub.ts.
#
#   bash scripts/write-hub-sync-env.sh <out-file> KEY:SECRET [KEY:SECRET ...]
#
# KEY is the name written to the file; SECRET is the GitHub secret it comes
# from, used only in the error message. Each value is read from the environment
# variable V_<KEY> (the workflow maps the secret onto it through `env:`). If any
# value is empty it prints the empty SECRET names — never a value — and exits 1
# without writing the file, so the import never runs on a half-configured cell.

out="$1"
shift

missing=()
for pair in "$@"; do
  key="${pair%%:*}"
  var="V_$key"
  if [ -z "${!var:-}" ]; then missing+=("${pair#*:}"); fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing GitHub 'production' environment secret(s): ${missing[*]}" >&2
  exit 1
fi

umask 077
: > "$out"
for pair in "$@"; do
  key="${pair%%:*}"
  var="V_$key"
  # Double-quoted values (CLAUDE.md env-format rule); written to the file only.
  printf '%s="%s"\n' "$key" "${!var}" >> "$out"
done
