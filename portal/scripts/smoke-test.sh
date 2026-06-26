#!/usr/bin/env bash
set -euo pipefail

# Usage: start the portal app locally (PORT from .env), then run this script.
# It sends two requests with different Host headers to validate tenant routing.

HOST=127.0.0.1:3004

echo "Smoke test for NEZAZI (Host: $NEZAZI_DOMAIN)"
curl -s -D - -H "Host: $NEZAZI_DOMAIN" "http://$HOST/" | sed -n '1,60p'

echo
echo "Smoke test for EZAZI (Host: ezazi.local)"
curl -s -D - -H "Host: ezazi.local" "http://$HOST/" | sed -n '1,60p'

echo
echo "If your app exposes an API health endpoint, replace '/' with that endpoint (e.g., /api/health)."
