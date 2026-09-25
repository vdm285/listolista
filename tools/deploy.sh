#!/bin/sh
# Deploy ListoLista's pieces to Cloudflare (free plan). Needs: `wrangler login` once (Victor's account).
#   tools/deploy.sh relay     -> the sync relay (Worker + Durable Object); prints its wss:// URL
#   tools/deploy.sh preview   -> a private preview copy of the app at https://listolista-preview.<account>.workers.dev
# The live site stays on GitHub Pages (main branch) until Victor approves going live.
set -eu
export PATH=/opt/homebrew/bin:$PATH WRANGLER_SEND_METRICS=false
cd "$(dirname "$0")/.."
case "${1:-}" in
  relay)
    ( cd relay && wrangler deploy )
    echo "Now rebuild the app with that address: python3 tools/build.py --relay wss://<the workers.dev host>"
    ;;
  preview)
    grep -q 'var LISTO_RELAY = "wss://' index.html || { echo "index.html has no relay address: run python3 tools/build.py --relay wss://..."; exit 1; }
    python3 tools/check-dict.py >/dev/null
    sh tests/run.sh >/dev/null
    STAGE=$(mktemp -d)
    mkdir "$STAGE/site"
    cp index.html sw.js manifest.webmanifest manifest-android.webmanifest "$STAGE/site"/ && cp -R icons "$STAGE/site"/icons
    # A static-assets Worker (Cloudflare's recommended way now); run outside the repo so no config is created here.
    ( cd "$STAGE" && wrangler deploy --name listolista-preview --assets ./site --compatibility-date 2026-09-01 )
    rm -rf "$STAGE"
    ;;
  *) sed -n '2,6p' "$0"; exit 1 ;;
esac
