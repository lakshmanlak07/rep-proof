#!/usr/bin/env bash
# Runs every safe local check and records the command, exit code and summary line for each.
# Usage: bash scripts/check-all.sh <log-file>
# Safe by design: test:live is read-only and anonymous; nothing here writes to production.
log="${1:-check-all.log}"
: > "$log"
failed=""
run() {
  local name="$1"; shift
  local out; out=$("$@" 2>&1); local code=$?
  [ "$code" -ne 0 ] && failed="$failed $name"
  printf '### %s\n$ %s\nexit=%s\n%s\n\n' "$name" "$*" "$code" "$(printf '%s\n' "$out" | grep -E "$SUMMARY" | tail -6)" >> "$log"
}
SUMMARY='error|warning|problem|^ℹ (tests|pass|fail)|PASSED|weakened|MISSED|TEST ERROR|probes|FAIL|Secret scan|vulnerabilit|Exported|exit' run typecheck npx tsc --noEmit
SUMMARY='error|warning|problem' run lint npx expo lint
SUMMARY='^ℹ (tests|pass|fail)|not ok' run unit npm test
SUMMARY='ALL SECURITY|weakened|MISSED|TEST ERROR|^FAIL' run db npm run test:db
SUMMARY='PASS|FAIL|verified' run db-safety npm run test:db:safety
SUMMARY='FAIL|verified' run export-integration npm run test:export
SUMMARY='^Tests:|^Test Suites:|✕' run screens npm run test:screens -- --ci
# SKIP_LIVE=1: no requests to production at all (e.g. an audit that forbids probing it); logged as skipped, never as passed.
if [ -n "$SKIP_LIVE" ]; then
  printf '### live\nSKIPPED (SKIP_LIVE set): no production requests\n\n' >> "$log"
  echo "live: SKIPPED (SKIP_LIVE set)"
else
  SUMMARY='All live|FAIL|fail ' run live npm run test:live
fi
# Same gate as CI: critical advisories fail; the full high/moderate counts are still logged (see SECURITY.md).
SUMMARY='vulnerabilit|critical' run audit npm audit --omit=dev --audit-level=critical
SUMMARY='vulnerabilit|critical' run audit-shipped npm audit --omit=dev --omit=optional --audit-level=critical
rm -rf dist
SUMMARY='Exported|Error|error' run export npx expo export --platform android --output-dir dist
SUMMARY='Secret scan|found|leak' run secrets npm run scan:secrets -- --history dist
# Fail closed: any failed step makes the whole run fail.
if [ -n "$failed" ]; then echo "FAILED:$failed" | tee -a "$log"; exit 1; fi
if [ -n "$SKIP_LIVE" ]; then echo "done: all local checks passed (live probes SKIPPED)" | tee -a "$log"; else echo "done: all checks passed" | tee -a "$log"; fi
