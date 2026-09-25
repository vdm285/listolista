#!/bin/sh
# Run the logic tests with macOS's built-in JavaScript engine (no install needed).
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
"$JSC" tests/matcher.test.js
