#!/usr/bin/env bash
# List (default) or erase (--erase) every ListoLista copy stored on the public HiveMQ broker.
# Why: shared lists were published as "retained" messages, which the broker keeps until someone
# replaces them. Erasing = publishing an empty retained message to each topic. The lists stay
# on the phones (local storage); a phone re-publishes its copy the next time it opens that list.
# Needs the Mosquitto command-line clients: brew install mosquitto
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
BROKER=broker.hivemq.com
list() { perl -e 'alarm 25; exec @ARGV' mosquitto_sub -h "$BROKER" -p 1883 -t 'listolista/#' \
           --retained-only -W 12 -F '%t %l' 2>/dev/null | sort || true; }

echo "Stored ListoLista lists on $BROKER (topic, size in bytes):"
topics=$(list)
[ -n "$topics" ] && echo "$topics" || { echo "  none"; exit 0; }

if [ "${1:-}" = "--erase" ]; then
  echo; echo "Erasing..."
  echo "$topics" | while read -r topic _; do
    mosquitto_pub -h "$BROKER" -p 1883 -t "$topic" -r -n && echo "  erased $topic"
  done
  sleep 2; echo; echo "Check:"; left=$(list); [ -n "$left" ] && echo "$left" || echo "  none left"
else
  echo; echo "Dry run. To erase them all, run: $0 --erase"
fi
