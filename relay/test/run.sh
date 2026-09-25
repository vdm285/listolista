#!/bin/sh
# Start the relay locally (no Cloudflare account needed), run the relay tests and the
# phone-side sync tests (tests/sync.test.mjs) against it, then stop it.
cd "$(dirname "$0")/.." || exit 1
export PATH=/opt/homebrew/bin:$PATH WRANGLER_SEND_METRICS=false
wrangler dev --ip 127.0.0.1 --port 8787 --persist-to .wrangler/test-state > .wrangler-dev.log 2>&1 &
PID=$!
for i in $(seq 1 60); do curl -sf http://127.0.0.1:8787/health >/dev/null 2>&1 && break; sleep 1; done
node test/relay.test.mjs; RC=$?
RELAY=ws://127.0.0.1:8787 node ../tests/sync.test.mjs || RC=1
kill $PID 2>/dev/null; wait $PID 2>/dev/null
rm -rf .wrangler/test-state
exit $RC
