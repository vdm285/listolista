#!/bin/sh
# Run the logic tests with macOS's built-in JavaScript engine (no install needed).
# Usage: tests/run.sh              (all tests)
#        tests/run.sh matcher      (only tests/matcher.test.js)
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
if [ $# -eq 0 ]; then set -- $(ls tests/*.test.js | sed 's|tests/||; s|\.test\.js||'); fi
rc=0
for t in "$@"; do
  echo "== $t"
  "$JSC" "tests/$t.test.js" || rc=1
done
exit $rc
