# ListoLista roadmap (single source of truth)

Updated: 2026-09-29. Owner: Victor. Any AI working on this repo reads `AGENTS.md`, then this
file, and updates both when something changes. Newest state at the top of each section.

Legend: ✅ done · 🔨 in progress · ⏳ waiting on Victor · 🔜 next · 💤 later · 🚩 flag (known limit)

---

## Where we are, in one line
**Checkpoint 1 is online as a private preview: https://listolista-preview.vdm285.workers.dev
(relay: listolista-relay.vdm285.workers.dev). Next: the two-phone test (Victor's household), fixes, then
go live on vdm285.github.io/listolista.**

---

## The horizon (checkpoints, not calendar dates)
Each checkpoint starts only when Victor is comfortable with the previous one.

| # | Checkpoint | Who uses it | Goal | Status |
|---|---|---|---|---|
| 0 | Safety patch | everyone on the old app | Close the injection hole, unguessable links, fix the sync race | ✅ live 2026-09-25 |
| 1 | **Quantum paper for two** | Victor's household | Private shared list that syncs instantly, works offline, installs as an app, optional aisle view | 🔨 built + tested locally; phone test pending |
| 2 | Friends and family | ~10-20 people | Feedback round; polish; own web address decided; first real-use dictionary improvements | 💤 |
| 3 | Public, open source | anyone | Licence, contribution rules (how to keep bad actors out), English, maybe a donate button | 💤 |
| — | Possible merge with compa-precio | — | Discuss later (price comparison + lists share the "zero friction, your data" philosophy) | 💤 |

---

## Checkpoint 1: what is done
- ✅ Research (dated, fact-checked): UX, sync options (incl. Google Sheets idea), phone platform,
  aisle sorting → `docs/research/2026-09-25-*.md`.
- ✅ Mock-ups of the two writing models (Papel vs Renglones), private page on claude.ai.
- ✅ Safety patch on the live site (main e3d6236).
- ✅ Tested building blocks in `src/`:
  - aisle matcher (68 tests; written by the local junior, reviewed and fixed with a written manual);
  - merge of two phones' copies (30 tests; local junior + senior fixes);
  - end-to-end encryption + relay client (21 tests); relay on Cloudflare Worker + Durable Object (16 tests).
- ✅ Aisle dictionary as editable data (1,651 words, 14 aisles, 8 KB compressed); checker; 40 tricky
  test items (24/35 correct now vs 19/40 before).
- ✅ The app rebuilt from those parts into one `index.html` (84 KB): calmer header, Compartir with
  status dot, undo, "Tachados (n)", long-press edit/delete/aisle, comma splitting, aisle view in
  walking order with synced corrections, offline note, iPhone install hint, automatic migration of
  old lists, home-screen app (manifest + offline cache + icons).
- ✅ End-to-end test on the Mac with two separate "phones" and a local relay: share, sync both ways
  (~1 s), aisle correction + title sync, undo, offline edits on both phones merge after reconnect.
- ✅ README.md and AGENTS.md updated; one-command deploy script (`tools/deploy.sh`).

## Checkpoint 1: what is left, in order
1. ✅ Cloudflare: account (linked to GitHub), `wrangler login`, workers.dev name `vdm285`.
2. ✅ Relay and private preview online (`tools/deploy.sh relay|preview`); live sync tests 21/21.
3. ✅ Independent code review (4 dimensions, 50 agents): 44 confirmed findings; the important ones
   fixed (see commit b058d88); the rest listed in the backlog.
4. ⏳ **Two-phone test, ~20 minutes** (an Android and an iPhone), on the preview:
   open the link, add/strike/undo, aisle view, Add to Home Screen from the link, airplane mode then
   back, lock and unlock the phone. Checklist in section "Phone test" below.
5. 🔜 Fix what the phone test finds.
   - 🐞 **Found by the HQ session's probes and property checker (2026-09-26), fix first** (`src/aisles.js`):
     1. After a number, the optional "de" eats the start of the next word: "2 detergentes" → Otros,
        "2 detergente en polvo" → Carnes ("pollo"), "3 desinfectante de cocina" → Carnes ("cecina").
     2. A trailing number of 2+ characters is only partly removed ("coca cola 600 ml" → key "coca cola 60"),
        and "v8"/"n95" lose their digits. The aisle usually stays right, but a saved aisle correction is ignored.
     3. `buildIndex` would crash on a dictionary term "constructor" (plain `{}`).
     Tested fix (3 lines; 68/68 tests, 19/20 probes, 31/31 properties on 6 seeds; add tests for each case):
     ```
     line 90:  (?:\\s+de)?   →  (?:\\s+de\\b)?        (same on line 91)
     line 93:  '^(.*)\\s*(?:('  →  '^(.*?)\\s+(?:('
     line 143: singles: {}   →  singles: Object.create(null)
     ```
     Spec gaps to decide (Victor): (a) ties between aisles are decided by dictionary order, so 8 of 10 tied
     words land away from the aisle that lists them ("papas" → Frutas, "condones" → Higiene); proposed rule:
     an exact term beats a singular-form match. (b) A quantity at both ends: remove both?
     Checkers: ~/local-ai/evals/probes/ and ~/local-ai/evals/properties/ (details in
     ~/local-ai/docs/research/2026-09-26-zero-cost-checks-A-B.md).
6. ⏳ **Go live:** merge `design/checkpoint-1` into `main` (GitHub Pages). Then erase the old
   plaintext copies on the public MQTT server (`tools/erase-broker-lists.sh --erase`, Victor runs it).

## Decisions waiting on Victor (priority order)
These are design and direction calls: the suggested default is a proposal and waits for Victor's
answer (silence is not a yes). Only purely technical choices may take their default after 7 days.

| # | Decision | Why it matters | Suggested default (needs Victor) |
|---|---|---|---|
| 2 | **Papel or Renglones** (try the mock-ups) | The main writing experience | Renglones (today's layout) |
| 3 | Your store(s) and their aisle walking order | Aisle view order | Produce first, then bread, meat, dairy, frozen… |
| 4 | 51 disputed dictionary words (`data/aisles-review.md`) | e.g. coffee: Despensa or Bebidas? | The old dictionary's choice |
| 5 | "huevos y leche" without a comma: one item or two? | Voice dictation often has no commas | One item (only commas split) |
| 6 | Web address before friends-and-family: stay on vdm285.github.io or move (e.g. Cloudflare Pages) | Changing later resets installs; github.io is shared with your other projects | Decide at checkpoint 2 |
| 7 | Licence (MIT? other) | Needed before inviting contributions | Decide at checkpoint 3 |

## 🚩 Known limits (flags)
- iPhone won't open the keyboard without one tap: the list shows instantly and the whole empty area
  is a tap-to-write zone (next best to zero-click).
- Android "Install app" without `start_url` in the manifest: to be checked on Victor's phone.
- Clocks: "latest change wins" uses each phone's clock; a phone with a very wrong clock could lose a
  tie-break. Fine for checkpoint 1; the council pilot may study a better clock.
- Whoever has the link can read and edit the list (the link is the key). If a link leaks, make a new
  shared list (a "new link" button is planned).

## Phone test checklist (checkpoint 1)
- [ ] Phone A (Android) opens the preview, writes 3 items, taps Compartir, sends the link to phone B (WhatsApp).
- [ ] Phone B opens the link on iPhone: the list appears; strike one item → struck on phone A.
- [ ] Phone B adds an item → appears on phone A within ~1-2 s.
- [ ] Hold an item → edit and delete work; Deshacer brings it back.
- [ ] Menu → Ordenar por pasillo; change one item's aisle → the other phone shows it.
- [ ] Phone B (iPhone): Share → Agregar a inicio **from the list link**; open the icon → the same list opens.
- [ ] Phone A (Android): menu → Instalar como app (or Chrome menu → Add to Home screen).
- [ ] Airplane mode on one phone, edit on both, airplane mode off → both lists match.
- [ ] Lock the phone 5 minutes, unlock → still in sync.
- [ ] Anything confusing, slow or annoying → note it here.

## After checkpoint 1 (backlog, not ordered)
- 💤 From social run 2 (2026-09-25, ~/local-ai/docs/intel/2026-09-25-run2-shopping-lists-and-arduino.md):
  see the list without unlocking (widget / lock-screen view); aisle order that learns from the order
  items get checked off per store; one summary notification instead of a ping per item; paste a
  recipe or free text → items; a Siri Shortcut / URL link so voice and AI assistants can add items;
  keep sharing free (if ever paid: one-time unlock); lead with privacy; check the name in other
  languages before launch. Victor's own phone-test feedback comes first.
- 💤 From the HQ session (2026-09-26): `src/merge.js` loses an `ovr` entry whose key is literally
  `"__proto__"` (found by the new probe set in ~/local-ai/evals/probes/). Harmless today, because
  `sanitize()` rejects `_` in ovr keys; one-line hardening: build `resultOvr` with `Object.create(null)`.
- 💤 Review leftovers (low severity): relay rate limits per IP/room creation; screen-reader focus kept
  across re-renders; dictionary as a lazily loaded file (pay-for-what-you-use); remove empty "LISTA"
  entries from Mis listas; move the app off the shared vdm285.github.io origin (secrets in
  localStorage are shared with Victor's other pages there) → strongly consider the own address.
- 💤 "Papel" mode (if chosen) or as an optional view.
- 💤 Grow the aisle dictionary with the local model (label hundreds of candidate words; a person reviews
  disagreements) → raise the test floor.
- 💤 "Nueva liga/enlace" (rotate a leaked link); export/import; "export to Google Sheet".
- 💤 Multiple stores (per-store aisle order).
- 💤 Notifications when the other person adds something (needs a server; probably never, by principle).
- 💤 Friends-and-family feedback form (no accounts).

## Log (newest first)
- 2026-09-29: working rules from Victor's HQ in `AGENTS.md`; personal details removed from the docs;
  decision column renamed "Suggested default (needs Victor)" (design calls wait for Victor).
- 2026-09-25 evening: relay deployed (Victor), review fixes, preview online, ready for the phone test.
- 2026-09-25: research ×4, mock-ups, safety patch live, building blocks + tests, dictionary as data,
  checkpoint-1 app built and tested locally, README/AGENTS updated. Cloudflare account created.
