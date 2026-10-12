#!/usr/bin/env bash
# Post-deploy smoke test. Usage: scripts/smoke.sh <base-url> <path>...
# The first path must also contain a <title>. Each URL is retried with backoff (propagation after a deploy).
set -uo pipefail
base="${1:?base url}"; shift
base="${base%/}"
first="${1:?at least one path}"
tmp="$(mktemp)"
fail=0
for path in "$@"; do
  url="$base$path"
  ok=0
  for attempt in 1 2 3 4 5 6; do
    code=$(curl -sS -o "$tmp" -w '%{http_code}' --max-time 20 -H 'Cache-Control: no-cache' "$url" || echo 000)
    if [ "$code" = "200" ] && { [ "$path" != "$first" ] || grep -qi '<title' "$tmp"; }; then ok=1; break; fi
    echo "  $url -> HTTP $code (attempt $attempt/6), retrying in $((attempt * 5))s"
    sleep $((attempt * 5))
  done
  if [ "$ok" = 1 ]; then echo "ok   $url"; else echo "::error::smoke test failed: $url"; fail=1; fi
done
rm -f "$tmp"
exit $fail
