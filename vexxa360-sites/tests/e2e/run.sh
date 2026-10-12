#!/usr/bin/env bash
# Roda o E2E completo: banco zerado + app em modo produção + Playwright.
set -euo pipefail
cd "$(dirname "$0")/../.."
tests/e2e/stack/reset.sh
pkill -f "[n]ext-server"  2>/dev/null || true
npx next build >/dev/null
(npx next start -p 3100 >/tmp/vx-next.log 2>&1 &)
for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:3100/login && break; sleep 1; done
npx playwright test "$@"
