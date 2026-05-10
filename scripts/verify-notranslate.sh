#!/usr/bin/env bash
# Verifies that the admin build output contains the auto-translate opt-out signals.
# Usage: bash scripts/verify-notranslate.sh
# Exits non-zero if any expected signal is missing.
# 関連: docs/designs/2026-05-05_admin-disable-auto-translate.md §5.4.3

set -euo pipefail

# Strapi 5 admin のビルド出力。バージョンによってパスが変わる可能性があるため、
# 候補を複数チェックする。
CANDIDATES=(
  "dist/build/index.html"
  "build/index.html"
  ".strapi/client/index.html"
)

OUT=""
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then OUT="$c"; break; fi
done

if [ -z "$OUT" ]; then
  echo "FAIL: admin build output not found in any of: ${CANDIDATES[*]}"
  echo "Hint: run 'npm run build' first."
  exit 1
fi

fail() {
  echo "FAIL: $1 missing in $OUT"
  exit 1
}

grep -q 'translate="no"' "$OUT" || fail 'translate="no"'
grep -qE 'class="[^"]*\bnotranslate\b' "$OUT" || fail 'class="notranslate"'
grep -q '<meta name="google" content="notranslate">' "$OUT" \
  || fail '<meta name="google" content="notranslate">'

echo "OK: notranslate signals present in $OUT"
