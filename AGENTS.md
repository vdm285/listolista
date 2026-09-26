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

## Working with Victor (copied from the workstation project, 2026-09-25)
- Interview and align before heavy building; build in checkpoints; at each milestone show a
  3-line status, a live preview and "how to test on your phone", then ask go/no-go.
- Explain in plain language; when his hands are needed (logins, terminal, phones) give numbered steps.
- When the ideal is impossible (e.g. iPhone's one-tap keyboard), do the next best thing and flag it.
- If something carries a real risk, explain it in 2-3 sentences and let him decide; no
  self-restricting rules or licence caveats (learning/portfolio stage).
- Test local AI juniors on natural chores (manual: ~/local-ai/docs/manuals/js-logic.md; log in
  ~/local-ai/benchmarks/junior-field-log.md).
- Nothing is pushed to GitHub or merged to `main` (the live site) without his OK.

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

## Current state
- `main` (live at vdm285.github.io/listolista): the original single file plus the 2026-09-25 safety
  patch (no injection, unguessable room ids, publish-after-merge, pinned mqtt.js). Shared lists still
  use the public HiveMQ broker in plain text until checkpoint 1 goes live.
- Branch `design/checkpoint-1` (not live): the rebuild, built by `tools/build.py` from `src/` into one
  `index.html`. End-to-end encrypted sync through our Cloudflare relay (`relay/`), link `#k=<secret>`;
  merge, aisle matcher and dictionary as tested modules; PWA (manifest without start_url, sw.js,
  icons); v1 lists migrate automatically. Tests: `sh tests/run.sh` (jsc) and `relay/test/run.sh`
  (Node + local wrangler). Deploy: `tools/deploy.sh relay|preview` after `wrangler login`.
- Waiting on Victor: Cloudflare account + `wrangler login`; Papel vs Renglones (build = Renglones);
  51 dictionary conflicts (`data/aisles-review.md`); his store's aisle order; two-phone test (wife
  iPhone, Victor Android) on the preview before going live.
- Known flags: iPhone needs one tap for the keyboard; "huevos y leche" without a comma stays one item;
  Android install without start_url to be checked on his phone.

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
- Edit `src/` and `data/`, never `index.html` directly; run `python3 tools/build.py`.
- Branch per piece of work; `main` is the live site.
- Tests before features: pure logic (matcher, merge, crypto) is tested headless with macOS
  `jsc` (built in; no Node needed); UI checked in a browser. Tests are protected: don't weaken
  them to make code pass.
- Local juniors (via ~/local-ai/scripts/delegate.sh) get bounded chores with a pass/fail command.
- Research lives in `docs/research/` (dated, fact-checked).
