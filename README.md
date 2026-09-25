# ListoLista

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left
> to take away." — Antoine de Saint-Exupéry

ListoLista is a shared shopping list that feels like a piece of paper: you open it and write.
Write "huevos, leche" at home; it appears on your partner's phone at the supermarket; they tap an
item to strike it and it's struck on yours. No accounts, no login screens, no servers to pay for.
The app speaks Spanish.

**Use it:** https://vdm285.github.io/listolista/

## Design philosophy
- **Zero-click start.** It opens straight into the list, ready to write. (On iPhone the keyboard
  needs one tap; the whole empty area is a tap-to-write zone.)
- **The Notepad benchmark.** Plain, instant, what you type is what you see.
- **Few clear choices.** The name of the list, *Compartir*, and one menu. Everything else is optional.
- **Pay for what you use.** The core loads first; optional features load only when you turn them on.
- **No accounts, ever.** The share link is the key.
- **Your data stays yours.** Lists live on your phone. Shared lists travel end-to-end encrypted: the
  relay in the middle sees only scrambled bytes and cannot read titles or items.

## Features
- Two fixed input rows at the top (the screen never jumps while you type). "huevos, leche y pan"
  adds three items.
- Tap to strike; hold to edit, delete or change aisle. *Deshacer* (undo) instead of "are you sure?".
- Struck items fold into *Tachados (n)* with a *Limpiar* button.
- **Compartir**: turns the list into a shared one and gives you a private link
  (`…/listolista/#k=<secret>`). Whoever has the link can read and edit the list.
- **Aisle view** (menu → *Ordenar por pasillo*): items grouped by supermarket aisle in the order you
  walk your store (menu → *Orden de los pasillos*). Correct an item's aisle once and the list
  remembers it for everyone.
- Works offline; changes sync when the signal comes back. Install it as an app from the browser
  (Android: menu → *Instalar como app*; iPhone: Share → *Agregar a inicio*, from the list's link).

## How it works
- **One file for users** (`index.html`), built from small, tested parts in `src/`:
  - `src/aisles.js`: aisle matcher (whole words, accents, plurals, quantities, typo guesses);
  - `src/merge.js`: merges two phones' copies (per-item "latest change wins", deletions kept);
  - `src/sync.js`: end-to-end encryption (AES-GCM, keys derived from the link secret with HKDF,
    1 KB padding, write token) and the phone side of the relay connection;
  - `src/app.js` + `src/app.html`: the app; `data/aisles-es-MX.txt`: the aisle dictionary.
- **Relay** (`relay/`): a Cloudflare Worker + Durable Object on the free plan. It stores one
  encrypted blob per list, accepts changes only with the right write token and the right version
  (compare-and-set), and forgets lists untouched for 180 days.
- Offline: a service worker (`sw.js`) keeps the app on the phone; lists live in local storage.

## Develop
```sh
python3 tools/build.py          # src/ -> index.html (+ sw.js)
sh tests/run.sh                  # matcher, merge, dictionary tests (macOS jsc, nothing to install)
relay/test/run.sh                # relay + sync tests against a local relay (needs Node + wrangler)
python3 tools/check-dict.py      # after editing data/aisles-es-MX.txt
tools/deploy.sh relay|preview    # Cloudflare (needs `wrangler login`)
```

## Built with AI
Human-in-the-loop: Victor (product owner and architect) designed it; the first versions were built
with Google Gemini (Canvas); the checkpoint-1 rebuild was done with Claude (senior developer) and a
local model on Victor's Mac (Qwen3.6-35B-A3B, junior developer) under written specs and tests.
See `AGENTS.md` for the briefing any AI agent reads first, and `docs/research/` for the dated,
fact-checked research behind the design.

## License
Not chosen yet (the owner will pick one before inviting contributions).
