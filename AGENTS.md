# AGENTS.md — ListoLista (read this first)

Vendor-neutral briefing for any AI agent working on this repo (Claude, ChatGPT/Codex, Gemini,
Grok, or a local model). `CLAUDE.md` just imports it. Whoever changes direction or architecture
updates this file.

## Owner
Victor (github.com/vdm285): product owner and architect. Mathematician/MBA with basic coding;
explain in plain language. He checks in at milestones: show progress, a live preview and "how
to test it on your phone" steps, then ask go/no-go. Nothing is merged to `main` (which is the
live site) or pushed to GitHub without his OK. Project stage: personal learning, portfolio and
open source; not commercial.

## Mission
A **"quantum-linked piece of paper"** for shopping lists. Victor writes "huevos, leche" at home;
it appears on his wife's phone at the supermarket; she taps an item and it is struck through on
his phone; she adds what he forgot. The benchmark is **Windows Notepad**: it opens instantly, you
see what you type, nothing else in the way.

Rollout by checkpoints (each one used and trusted before the next):
1. Victor + his wife.
2. Friends and family (feedback).
3. Free public open-source app (community contributions; maybe a donate button).

## Design principles (non-negotiable)
1. **Zero-click start:** open straight into the list, ready to write. Cut every predictable click.
   (iPhone and Android won't raise the keyboard without one tap, so the list and a large
   tap-to-write area appear in the first frame.)
2. **Few clear choices:** secondary actions live in one labelled menu or small edge icons.
3. **Pay for what you use:** the bare core loads first; optional features (aisle dictionary,
   sync library) load only when used.
4. **No accounts, no login screens, ever.** Share by link; the link is the key.
5. **Optionality:** dead-simple default; power features are opt-in switches.
6. **Zero running cost** for Victor.
7. Spanish first (English when it goes public).

## Current state (2026-09-25, `main` = 2e5bc85, live at vdm285.github.io/listolista)
Single-file vanilla HTML/JS (`index.html`, ~100 KB, 69% of it the aisle dictionary), Spanish UI.
localStorage persistence, several lists, shared lists synced via the public HiveMQ MQTT broker
(retained full-state JSON per room, per-item latest-change-wins with deletion markers), aisle
sorting from a ~1,660-entry Mexican-Spanish dictionary. `sandbox.html` = the MQTT experiment.
No tests yet.

Known problems (details in `docs/research/2026-09-25-*.md`):
- Shared lists are readable by anyone (plain JSON on a public broker; room ids are guessable
  timestamps). Titles from the network are inserted as HTML (code-injection risk, line ~621).
- On connect the app publishes before merging (sync race); a 5-second presence loop leaks timers.
- The unpinned mqtt.js loads from unpkg in `<head>` and blocks the first paint; offline, shared
  lists stay behind a "Conectando..." overlay.
- The aisle matcher finds words inside words ("pantuflas" → bakery); 50 conflicting duplicate
  keys; 75 accented keys can never match; aisles show alphabetically.
- Pinch-zoom is disabled. README describes features that no longer exist.

## Decisions so far
- Writing model: "paper" (Notepad-like lines) vs "rows" (input on top): Victor decides after
  trying the mock-ups (claude.ai artifact, 2026-09-25).
- Checkpoint 1 includes: private encrypted share link, instant sync + strike-through,
  home-screen icon + offline, optional aisle sorting. Spanish.
- Sync: end-to-end encrypted, key in the link's `#` part; relay behind one small interface
  (Cloudflare Worker + Durable Object recommended; encrypted public MQTT as zero-setup fallback).
  Google Sheets is not the sync channel; maybe "export to Sheet" later.
- Aisle sorting: rewrite the matcher (whole words, accents folded, plurals, quantities); 14
  aisles in walking order; corrections synced per list; no on-device ML for now.

## How to work here
- Branch per piece of work; `main` is the live site.
- Tests before features: pure logic (matcher, merge, crypto) is tested headless with macOS
  `jsc` (built in; no Node needed); UI checked in a browser. Tests are protected: don't weaken
  them to make code pass.
- Local juniors (via ~/local-ai/scripts/delegate.sh) get bounded chores with a pass/fail command.
- Research lives in `docs/research/` (dated, fact-checked).
