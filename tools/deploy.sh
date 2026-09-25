#!/bin/sh
# Deploy ListoLista's pieces to Cloudflare (free plan). Needs: `wrangler login` once (Victor's account).
#   tools/deploy.sh relay     -> the sync relay (Worker + Durable Object); prints its wss:// URL
#   tools/deploy.sh preview   -> a private preview copy of the app at https://listolista-preview.pages.dev
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
    python3 tools/check-dict.py >/dev/null
    sh tests/run.sh >/dev/null
    STAGE=$(mktemp -d)
    cp index.html sw.js manifest.webmanifest "$STAGE"/ && cp -R icons "$STAGE"/icons
    wrangler pages project create listolista-preview --production-branch main 2>/dev/null || true
    wrangler pages deploy "$STAGE" --project-name listolista-preview --branch main --commit-dirty=true
    rm -rf "$STAGE"
    ;;
  *) sed -n '2,6p' "$0"; exit 1 ;;
esac
