# ListoLista aisle sorting: categorizing grocery items offline (verified 2026-09-25)

- **Scope:** how ListoLista should sort Mexican-Spanish grocery items into supermarket aisles, on the phone, offline, for design checkpoint 1.
- **Repo / branch:** `/Users/victor/projects/listolista`, `design/checkpoint-1` (code checked at commit `2e5bc85`).
- **Method:** a draft research result was fact-checked adversarially. Every high-relevance claim was re-checked. Local claims were re-run against the app's **exact JavaScript** (macOS `jsc`), not only the draft's Python port. The local-model test was re-run twice. Web sources were re-opened and their dates confirmed.
- **Status labels used below:** CONFIRMED, CORRECTED (true in substance, a detail was wrong), UNVERIFIED (could not be checked), REFUTED (none this time).

---

## Bottom line

- **Today's wrong aisles come mostly from how the matcher is built, not from missing words.** Running the app's own code confirms it: short words fire inside longer ones ("te" in *tenis* and *sartén*, "res" in *flores*, "pino" in *champiñones*, "gel" in *verduras congeladas*).
- **The dictionary has hidden defects.** 75 of its 1,659 words can never match, because they keep accents or ñ while typed text has them removed. 50 words are listed twice with different aisles, and the second entry silently wins. Aisles are shown alphabetically, not in walking order. The aisle is frozen when an item is added, so dictionary fixes never reach old items.
- **A better matcher using the same words helps a lot and costs almost nothing.** On 40 deliberately tricky items it gets 26 right instead of 19, and it cuts confidently wrong answers from 15 to 5. The remaining misses are missing words, the missing "Congelados" aisle, or family choices (for example *pan molido*).
- **The local Qwen3.6-35B is a good labeler for building the dictionary on the Mac.** Re-run today it scored 37/40 in 27 seconds, and 36/40 with a neutral prompt. It should grow the word list on the Mac; the phone gets only the list.
- **AI running inside the phone is not worth it for checkpoint 1.** The smallest suitable model is a 108-124 MB download, plus a 3-5.5 MB runtime, plus a tokenizer of up to 17 MB. The whole dictionary is about 8 KB compressed today, and about 20-25 KB if it triples. Chrome's free built-in AI model does not run on phones (Google docs, 2026-08-26).
- **Copy what the good list apps do.** Remember a correction for everyone on the shared list (AnyList). Let people put the aisles in their own store's order (AnyList, OurGroceries, Bring!). Keep the aisle view optional; Apple Reminders users complain when sections are forced on them.
- **Reorder aisles with ↑/↓ buttons.** Samsung Internet and Firefox for Android do not support HTML drag-and-drop (caniuse data, 2026-09-24).
- **The best Mexican word source is PROFECO's price-survey open data.** It is CC BY 4.0 and was updated 2026-09-22. The download is blocked from this Mac's connection, so its contents are unchecked. Open Food Facts uses Spain's Spanish and requires share-alike licensing.
- **One change to the draft plan:** the app has no offline cache (service worker) today. For checkpoint 1, keep the dictionary inside `index.html` in a compact format rather than as a separate file that might fail to load in a store with weak signal.

---

## 1. Audit of today's matcher (index.html, verified 2026-09-25)

The matcher is `normalize()` + `categorize()` at `index.html` lines 451-468. It checks for an exact match first, then tries every dictionary key, longest first, as a **substring** of the whole item text.

| Finding | Verified value | Example / evidence |
|---|---|---|
| Key:value pairs / unique keys | 1,720 / 1,659 | Regex count over the `SUPERMARKET_DICT` block |
| Keys listed more than once | 57 | - |
| ...of which with conflicting aisles (last one silently wins) | 50 | *atun* (Carnes vs Despensa), *galletas* (3 aisles), *papel higienico* (Limpieza vs Higiene) |
| Keys with accents/ñ that can never match | 75 | *papel de baño* returns no aisle; *champiñones* returns Limpieza (via "pino") |
| ...of those with no plain-spelling twin in the dictionary | 67 | only 8 have an unaccented copy, e.g. *pañales* / *panales* |
| Short keys (3 letters or fewer) used as substrings | 16 | aji, ajo, ate, col, gel, m&m, nan, pan, pez, res, ron, sal, sol, sq, te, uva |
| Dictionary share of `index.html` | 69.2 KB of 100.6 KB (9.8 KB gzip) | Measured with `gzip -9` |
| Aisle display order | Alphabetical | `Object.keys(grouped).sort()`, line 652 |
| When the aisle is decided | Once, when the item is added; stored as an emoji label in `item.category` and synced | `addItem()`, line 476; never recomputed |

**Misfires confirmed with the app's exact JavaScript** (run in macOS `jsc`, 2026-09-25):

| Typed | App answer | Key that fired |
|---|---|---|
| tenis / tapete de baño / sartén / detergnte | Bebidas | te |
| flores | Carnes y Pescados | res |
| aguacte (typo) | Bebidas | agua |
| tapioca | Frutas y Verduras | apio |
| cocada | Bebidas | coca |
| verduras congeladas | Higiene Personal | gel |
| pantuflas | Panadería | pan |
| sal de uvas | Frutas y Verduras | uvas |
| leche de almendra | Botanas y Dulces | almendra |
| champiñones | Limpieza y Hogar | pino |

---

## 2. Before and after on 40 tricky items

The draft built a 40-item test set around known traps, plus a Python prototype of a better matcher. Both were re-run today and gave identical results.

| Matcher | Correct / 40 | Confidently wrong (of 36 comparable) | Notes |
|---|---|---|---|
| Today's app (substring, longest key) | 19 | 15 | Reproduced in real JS (`jsc`) and in the Python port |
| Prototype: same words, better matching | 26 | 5 | Python prototype only; not yet ported to JS |
| Local Qwen3.6-35B labeler, draft prompt | 37 | - | Re-run: 27.4 s, 1,081 output tokens |
| Local Qwen3.6-35B labeler, neutral prompt | 36 | - | Aisle names only, no hints (see caveat) |

"Confidently wrong" means a wrong aisle rather than "Otros". The 4 frozen-food items cannot pass on either dictionary matcher, because the old dictionary has no Congelados aisle.

**Caveats (important):**
- The test set was written by the researcher around known misfires. It shows the *kind* of fix that works; it is **not** an accuracy estimate for real lists.
- The draft's Qwen prompt described some aisles with hints that match test items, for example "carnitas", "pan molido", "hielo, helado" and "antiácidos". With plain aisle names Qwen still got 36/40. It missed *3 leches*, *sartén*, *leche de almendra* and *papel de baño*; the last two are store-dependent.
- Qwen was tested on 16 aisles (Salchichonería and Vinos separate); the recommendation below uses 14.

**Why the prototype still misses 10 of the 36 comparable items:**
- 8 are missing words: *sal de uvas*, *tres leches*, *carnitas*, *tapete*, *sartén*, *cocada*, *tapioca*, *mantequilla de maní*. *Sal de uvas* is still confidently wrong: "sal" (salt) is found and wins as the leftmost word.
- 2 are dictionary choices that differ from the test's expected answer, both store-dependent: *pan molido* (dictionary: Panadería) and *papel de baño* (dictionary: Higiene).

---

## 3. Typo tolerance: useful but risky

Among 1,196 distinct dictionary words (longer than 2 letters), **138 pairs** are one typo apart (Damerau-Levenshtein distance 1) yet belong to different aisles. Simple singular/plural pairs are excluded. 67 of the pairs involve words of 4 letters or fewer. Examples: *lechuga/pechuga*, *chicles/chiles*, *arena/avena*, *canela/panela*, *papilla/pasilla/pastilla*. A few are harmless gender variants (*blanca/blanco*).

**Consequence:** correct typos only as a last resort, only on words of 5+ letters, and only when every closest match points to the same aisle. Show the result as a guess (lighter tag). In the prototype this rule fixed *aguacte*, *detergnte* and *yogurth* without new errors on the test set.

---

## 4. Spanish word handling

- **Accent folding (CONFIRMED locally).** In JavaScript, `normalize("NFD")` splits ñ into n plus a combining tilde, so removing combining marks turns *pañales* into *panales*. Tested in `jsc` and `osascript -l JavaScript`; `/\p{M}/gu` also works. Dictionary keys must be folded the same way when the dictionary is built.
- **Plurals (approach CONFIRMED locally; RAE source UNVERIFIED).** Trying the candidates *w*, *w* minus -s, *w* minus -es, and -ces → -z covers grocery plurals such as *limones*, *nueces*, *chiles* and *jitomates*. A single fixed rule broke *chiles* → *chil*. The RAE plural page could not be opened (403 bot check), so the grammar summary rests on general knowledge and on the local test.
- **Stemmers are too aggressive (CONFIRMED).** The Snowball Spanish stemmer also strips gender and derivational endings (*chica* → *chic*, *totalidad* → *total*). A dictionary lookup needs only plural handling.

---

## 5. On-device AI: cost versus benefit (sizes measured 2026-09-25)

| Model (smallest browser-ready file) | Download | Note |
|---|---|---|
| multilingual-e5-small (Xenova) | 118.1 MB int8 | + tokenizer.json 17.1 MB |
| paraphrase-multilingual-MiniLM-L12-v2 (Xenova) | 118.1 MB int8 | - |
| static-similarity-mrl-multilingual-v1 | 108.4 MB int8 | + tokenizer 2.6 MB |
| EmbeddingGemma-300m (ONNX) | 175-197 MB q4 | Gemma licence |
| Bekko a8m (arXiv, 2026-07-28) | 124 MiB int8 | Runs in browser via Transformers.js |
| potion-multilingual-128M | 512 MB | - |
| **Runtime:** onnxruntime-web 1.30.0 WASM | 14.2-28.3 MB raw; 3.1-5.5 MB brotli | Latest stable on npm today |
| **Runtime:** Transformers.js | 4.3.0 is latest | v4 released 2026-02-09 |

**Platform news checked:**
- Safari 26 (2025-09-15) ships WebGPU on iOS and iPadOS, so phones could compute this. Download size, not speed, is the blocker.
- Chrome's built-in Prompt API (Gemini Nano) is stable on desktop. Google's page (updated 2026-08-26) says Chrome for Android and iOS are "not yet supported". Desktop also needs 22 GB of free disk. **It does not help a phone shopping list.**
- Transformers.js v4 (2026-02-09) brought a new WebGPU runtime and a ~4x speedup for BERT-style embedding models. The model files are no smaller.

**Pattern from industry (CONFIRMED, older source):** Mercari (2024-05-31) had an LLM label a few million items, then used a cheap embedding-based nearest-neighbour model for 3+ billion. Classifying everything directly with the LLM was estimated at about US$1M and 1.9 years. The same idea applies here: the LLM works at build time on the Mac, and the phone gets a cheap lookup.

**Small learned models on tiny data are weak (CONFIRMED):** a hobby grocery classifier trained on about 700 labeled items reached 61% accuracy. Curated vocabulary beat using all word patterns (61% vs 40%) (dgendill.com, 2025-09-18).

---

## 6. What competitors do

| App | Auto-categorize | Spanish | Remembers corrections | Store / aisle order |
|---|---|---|---|---|
| Apple Reminders | Yes (grocery lists) | es-LatAm and es-ES added in iOS 18 | Not documented; the fix is manual reassignment | Users complain about forced sections |
| AnyList | Yes for common items; unknown items go to the list's default category | Not checked | Yes, per list, for all members since v5.9 (was per user before) | "Category sets" per store; an item can sit in a different category in each set |
| OurGroceries | Guesses (language-sensitive); can ask or leave uncategorized | Language support not listed | Yes, remembered per item | Reorder categories; assignments are the same across all lists |
| Bring! | Yes, icon and category | Not checked here | Only custom items can be recategorized | Reorder per list: Profile > Settings > List settings |
| Listonic | Yes for known products; custom items default to "other" | Not checked | Custom items saved and reused in new lists | Not checked |
| Google Keep | No native aisle grouping found | - | - | Gemini voice-to-list needs Google AI Pro/Ultra (2026-08-23) |
| AisleMate (2025) | Claims per-store learning | English | Claimed | UNVERIFIED (not re-checked) |

**Lessons that survived checking:**
- **Shared memory of corrections** is the norm. AnyList moved from per-user to per-list memory in v5.9, so everyone on a shared list sees the same categories.
- **Store order** is universal. AnyList's per-store category sets are the most complete version. OurGroceries warns that one global order "works best" if you mostly shop at one store.
- **Forced sections annoy people.** An Apple Community thread (2025-01-30) about Reminders' auto-sections has 32 "me too" marks, and the suggested workaround did not help.

---

## 7. Data sources for the dictionary

| Source | Content | Licence | Fit |
|---|---|---|---|
| PROFECO "Quién es Quién en los Precios" 2026 | Real Mexican product names, presentations, brands, CATEGORÍA, CATÁLOGO, store chain | CC BY 4.0 (attribution) | **High** for words and brands. Categories are not aisles. 9 CSVs cover Jan, Feb (2nd half), May, Jun and Jul 2026. Metadata updated 2026-09-22. CSV download blocked ("Access Denied") from this connection, so the category values are **UNVERIFIED** |
| Open Food Facts categories taxonomy | 8,282 English category entries, 2,813 with a Spanish name (3.3 MB file) | Database ODbL (share-alike); contents DbCL; images CC BY-SA; no separate taxonomy licence stated; the file sits in an AGPL-3.0 repo | **Low-medium.** Spain-centric Spanish (21 Spanish lines use *patata*, 6 use *papa/papas*). Corn tortillas have no Spanish label. Food only, a product hierarchy, not aisles |
| Google product taxonomy | es-ES only (version 2021-09-21); es-MX and es-419 return 404 | Not checked | Low |
| Retailer sites (Chedraui, Walmart MX, Soriana) | Department names, e.g. Salchichonería; Carnes, Pescados y Mariscos | Proprietary | Naming inspiration only; do not scrape |
| Current dictionary | 1,659 terms | Project | Seed; resolve the 50 conflicts first |

A useful fact from a retailer page: Chedraui lists *Sal de Uvas Picot* under Farmacia > Medicamentos > Estomacales. It is an antacid, not fruit.

---

## 8. Browser support for reordering aisles (caniuse data, updated 2026-09-24)

| Feature | Samsung Internet 30 | Chrome Android 152 | Firefox Android 156 | iOS Safari 27.2 |
|---|---|---|---|---|
| HTML5 drag-and-drop API | No | Yes | No | Yes |
| Pointer Events (custom drag handle) | Yes | Yes | Yes | Yes |

Up/down buttons work everywhere and are the simplest option. A Pointer Events drag handle is also viable later.

---

## 9. Library sizes (measured 2026-09-25 from jsDelivr)

| Library | Raw | Gzip |
|---|---|---|
| fuse.js 7.5.0 (min) | 26.1 KB | 9.2 KB |
| @leeoniya/ufuzzy 1.0.19 (min) | 8.4 KB | 4.0 KB |
| fastest-levenshtein 1.0.16 (unminified) | 3.8 KB | 1.0 KB |
| natural 8.1.1 porter_stemmer_es.js | 9.1 KB | 2.6 KB |
| @nlpjs/lang-es 4.26.1 stemmer-es.js | 34.8 KB | 5.1 KB |

A hand-written Damerau-Levenshtein function is about 20 lines, so no library is needed. This fits the README's "zero external dependencies" rule.

---

## Recommendation for checkpoint 1

### A. Matcher (about 80-120 lines, under 3 KB, no libraries)
1. **Fold** text to lowercase with no accents (NFD, then remove `\p{M}`, so ñ becomes n). Fold the dictionary keys the same way when the dictionary is built.
2. **Strip quantities at the start or end:** `2 kg de`, `1/2`, `medio kilo de`, `3 litros`. Digits followed by a noun mean a quantity (*3 leches* = milk). Number *words* stay part of the name (*tres leches* = cake).
3. **User corrections first:** check this list's corrections, then the device's.
4. **Exact phrase**, then its singular forms.
5. **Whole-word phrase scan:** longest phrase first, then the leftmost (Spanish puts the main noun first). Skip filler words on their own (de, para, con, sin, y, en, marca...). Try plural candidates (w, w-s, w-es, -ces→z).
6. **Typo fallback**, only for words of 5+ letters: 1 edit, or 2 edits at 8+ letters. Accept only if all the closest matches agree on one aisle. Mark the result as a guess.
7. Otherwise **Otros**.
8. Also: sort the dictionary keys once, not on every add.

### B. Aisles
14 aisles with stable IDs, in a default walking order that the family can edit:
FRU Frutas y verduras 🥦 · PAN Panadería y tortillería 🍞 · CAR Carnes y salchichonería 🥩 · LAC Lácteos y huevo 🧀 · CON Congelados 🧊 (new) · DES Despensa 🥫 · BOT Botanas y dulces 🍫 · BEB Bebidas y licores 🥤 · LIM Limpieza y hogar 🧹 · HIG Higiene personal 🧴 · FAR Farmacia 💊 · BBE Bebés 🍼 · MAS Mascotas 🐶 · OTR Otros 🛒.
The produce-first order rests on general (US-based) store-layout sources (Chowhound, 2024-02-04). No Mexican evidence was found, so **confirm the order against the store you actually use.**

### C. Data model and sync
- **Work out the aisle when the list is displayed** instead of saving it on each item. Then dictionary updates also fix old items. Existing `item.category` labels can simply be ignored.
- **Sync two things per list** inside the existing retained MQTT state:
  - `ovr`: corrections, keyed by the cleaned-up item name. Merge each entry separately; the newest timestamp wins, like items do today.
  - `order`: the aisle order, where the newest timestamp wins for the whole list.
- Also keep a per-device copy of corrections in localStorage, so they carry over to new lists (see open question 7).

### D. UI
- Tap an item's small aisle tag, then pick from 14 buttons. The correction is remembered for everyone on the list.
- The 🏪 aisle view stays an optional toggle, remembered per list.
- Put "Ordenar pasillos" in the cog menu, with ↑/↓ buttons (not HTML5 drag-and-drop).
- In "paper" mode, show aisles as a separate read-only shopping view, so lines never jump under the cursor while typing.

### E. Dictionary packaging (changed from the draft)
- **Keep the dictionary inline in `index.html` for checkpoint 1,** but in the compact grouped form (`ID: term|term|…`). That form is 22.9 KB raw and 7.6 KB gzip, against 69.2 KB raw today.
  - **Why:** the app has no service worker or manifest today, so a separate `aisles-es-MX.json` could fail to load in a store with weak signal.
  - **Later:** move the dictionary to its own file once offline caching is added.
- Budget: 30 KB gzip or less. About 5,000 terms should fit in roughly 20-25 KB; that is a straight-line estimate, not a measurement.
- Keep a human-editable source (for example `data/aisles-es-MX.txt`), plus a small checker script. It should fail on duplicate keys with conflicting aisles, and on unfolded accents.

### F. Growing the dictionary (on the Mac, not on the phone)
1. Resolve the 50 conflicting duplicates.
2. Gather candidate words: PROFECO product and brand names (CC BY 4.0, with attribution), plus Qwen brainstorms per aisle (colloquial names, brands, diminutives).
3. Label them with local Qwen3.6-35B: thinking off, temperature 0, output forced to the aisle IDs (llama-server's `response_format` json_schema works; verified locally), 40-100 items per batch.
4. Cross-check with a second, shuffled pass. Send disagreements and Spain-isms (*patata*, *zumo*, *nata*) to a review file for Victor and his wife.

### G. Tests
- Save the 40 tricky items as `tests/aisles-es-MX.tsv` (item, expected ID, store-dependent flag). Add a second set from real family lists.
- Run the exact JS matcher headless with macOS's built-in `jsc`. It needs no install, so it fits `delegate.sh` as a pass/fail check.
- Pass rule: 100% on items not marked store-dependent; at least 95% on real lists.

### H. Not in checkpoint 1
- **On-device ML.** Revisit only if more than about 5% of real items land in "Otros" after a couple of months of use. Even then, first try a small character-pattern classifier trained from the dictionary (tens to hundreds of KB). FastText-style compression shows such models can be about 100x smaller (2016 paper, old).
- **Open Food Facts, unless needed.** Using it would make the dictionary share-alike (ODbL).
- **Scraping retailer catalogs.**

---

## Test set: 40 tricky items (Mexican Spanish)

- "Hoy" is what `index.html` returns today; it was verified with `jsc`.
- "Proto" is the Python prototype's answer ("?" means a typo guess).
- "Qwen" is the local model's answer with the draft prompt; a † marks a different answer with the neutral prompt.
- "(varía)" marks a store-dependent item.

| # | Artículo | Pasillo esperado | Trampa | Hoy | Proto | Qwen |
|---|---|---|---|---|---|---|
| 1 | pantuflas | Otros | "pan" substring | Panadería ✗ | ✓ | ✓ |
| 2 | sal de uvas | Farmacia | antacid; "uvas", "sal" | Frutas ✗ | Despensa ✗ | ✓ |
| 3 | pastel tres leches | Panadería | "leche" | ✓ | ✓ | ✓ |
| 4 | tres leches | Panadería | number word vs quantity | Lácteos ✗ | Lácteos ✗ | ✓ |
| 5 | 3 leches | Lácteos | digit = quantity | ✓ | ✓ | Panadería ✗ |
| 6 | carnitas | Carnes (varía: rosticería) | missing word | none ✗ | Otros ✗ | ✓ |
| 7 | 2 kg de tortillas | Panadería | qty + unit + de | ✓ | ✓ | ✓ |
| 8 | 1/2 docena de huevos | Lácteos | fraction + unit | ✓ | ✓ | ✓ |
| 9 | medio kilo de jamón de pavo | Carnes y salchichonería | quantity in words | ✓ | ✓ | ✓ |
| 10 | Coca Cola 3 litros | Bebidas | trailing qty, brand | ✓ | ✓ | ✓ |
| 11 | tenis | Otros | "te" | Bebidas ✗ | ✓ | ✓ |
| 12 | tapete de baño | Limpieza y hogar | "te", ñ | Bebidas ✗ | Otros ✗ | Otros ✗ (✓†) |
| 13 | sartén | Limpieza y hogar | "te" | Bebidas ✗ | Otros ✗ | Otros ✗ |
| 14 | cocada | Botanas y dulces | "coca" | Bebidas ✗ | Otros ✗ | ✓ |
| 15 | flores | Otros (varía) | "res" | Carnes ✗ | ✓ | ✓ |
| 16 | ajonjolí | Despensa | "ajo" | ✓ | ✓ | ✓ |
| 17 | tapioca | Despensa | "apio" | Frutas ✗ | Otros ✗ | ✓ |
| 18 | leche de almendra | Lácteos (varía) | head noun vs "almendra" | Botanas ✗ | ✓ | ✓ (Despensa†) |
| 19 | mantequilla de maní | Despensa | needs the phrase | Lácteos ✗ | Lácteos ✗ | ✓ |
| 20 | tortillas de harina | Panadería | "harina" | ✓ | ✓ | ✓ |
| 21 | chiles en vinagre | Despensa | canned vs fresh | ✓ | ✓ | ✓ |
| 22 | chiles poblanos | Frutas y verduras | plural -es trap | ✓ | ✓ | ✓ |
| 23 | champiñones | Frutas y verduras | ñ key; "pino" | Limpieza ✗ | ✓ | ✓ |
| 24 | papel de baño | Limpieza (varía) | ñ key; duplicate conflict | none ✗ | Higiene ✗ | ✓ (Higiene†) |
| 25 | pañales etapa 3 | Bebés | ñ + trailing number | ✓ | ✓ | ✓ |
| 26 | helado de vainilla | Congelados | "vainilla" | Despensa ✗ | Botanas ✗ | ✓ |
| 27 | bolsa de hielo | Congelados | "bolsa" as unit | none ✗ | Otros ✗ | ✓ |
| 28 | verduras congeladas | Congelados | "gel" | Higiene ✗ | Otros ✗ | ✓ |
| 29 | croquetas de pollo | Congelados | "croquetas" = pet food | Mascotas ✗ | Mascotas ✗ | ✓ |
| 30 | croquetas para perro | Mascotas | control case | ✓ | ✓ | ✓ |
| 31 | pan molido | Despensa (varía) | "pan" | Panadería ✗ | Panadería ✗ | ✓ |
| 32 | crema para manos | Higiene personal | "crema" | ✓ | ✓ | ✓ |
| 33 | vinagre de manzana | Despensa | "manzana" | ✓ | ✓ | ✓ |
| 34 | jugo de manzana | Bebidas | head noun | ✓ | ✓ | ✓ |
| 35 | cerveza Modelo | Bebidas y licores | brand | ✓ | ✓ | ✓ |
| 36 | aguacte | Frutas y verduras | typo; "agua" | Bebidas ✗ | ✓? | ✓ |
| 37 | detergnte | Limpieza y hogar | typo; "te" | Bebidas ✗ | ✓? | ✓ |
| 38 | yogurth | Lácteos | spelling variant | ✓ | ✓? | ✓ |
| 39 | jitomates | Frutas y verduras | plural | ✓ | ✓ | ✓ |
| 40 | atún en lata | Despensa | duplicate conflict | ✓ | ✓ | ✓ |
| | **Total** | | | **19** | **26** | **37** (36†) |

**Suggested additions from real use:** *papas* (potatoes vs Sabritas), Maseca, Zote, Suavitel, bolis, Electrolit, *chicharrón* (snack vs butcher), queso Oaxaca, salsa Valentina, Maruchan.

---

## Corrections from verification

1. **"All remaining misses are vocabulary gaps" (C05): CORRECTED.** 8 of the prototype's 10 comparable misses are missing words. 2 (*pan molido*, *papel de baño*) are store-dependent dictionary choices. *Sal de uvas* is still confidently wrong via "sal". The 19 → 26 and 15 → 5 figures are confirmed.
2. **Open Food Facts counts (C24): CORRECTED.** The file is 3.33 MB with 8,282 English entries, of which 2,813 have a Spanish name (the draft said 3.6 MB, 9,244 and 3,564). 21 Spanish lines use *patata* and 6 use *papa/papas* (the draft said 24 and 2). The conclusion (Spain-centric, no Spanish label for corn tortillas) stands. The file was last committed 2026-09-25.
3. **fastest-levenshtein size (C07): CORRECTED.** Raw is 3.8 KB unminified, not 1.8 KB; gzip 1.0 KB is right. The Fuse.js and uFuzzy figures are confirmed.
4. **Qwen 37/40 (C35): CONFIRMED with a caveat.** Re-run gave 37/40 in 27.4 s (the draft said 25.5 s). The draft prompt contained hints matching test items; a neutral prompt gave 36/40.
5. **Dead accented keys (C02): refined.** All 75 are confirmed; 67 of them have no plain-spelling twin, so they really are lost.
6. **AnyList (C15): source refined.** "Unknown items go to the default category" comes from AnyList's default-category help page, not the v5.9 notes. v5.9 moved categories from per-user to per-list.
7. **Competitor table: corrected.**
   - OurGroceries' supported languages are not listed (the draft said "many languages").
   - Bring! lets users recategorize only custom items.
   - Listonic puts unknown custom items in "other".
8. **On-device size (C28): addition.** Tokenizers add to the download: e5-small's tokenizer.json is 17.1 MB.
9. **Draft recommendation "cache the dictionary in the service worker": CORRECTED.** No service worker exists in the app today. See Recommendation E.
10. **Draft missed:**
    - Chrome's built-in Prompt API is not available on Android or iOS (Google docs, updated 2026-08-26).
    - Firefox for Android also lacks HTML5 drag-and-drop.
    - Pointer Events work on all four target mobile browsers.

---

## Open questions / for Victor

1. **Phone and browser:** which does your wife use (Samsung Internet, Chrome or Safari)? This affects the reordering control, and whether iOS 18 Reminders is a relevant comparison.
2. **Store:** which store(s) do you use, and what is the real walking order? Only US-based layout sources were found.
3. **Aisles:** are 14 right? Should Carnes/Salchichonería and Bebidas/Licores stay merged?
4. **Otros:** should uncategorized items show at the top (easy to spot and fix) or at the bottom?
5. **Family decisions on store-dependent items:**
   - papel de baño (Limpieza vs Higiene)
   - pan molido (Despensa vs Panadería)
   - carnitas (Carnes vs rosticería)
   - leche de almendra (Lácteos vs Bebidas/Despensa)
   - flores
   - *papas* on its own (potatoes vs chips)
6. **PROFECO CSVs:** they are blocked from this Mac's connection. Could you download one month in a browser, so the CATEGORÍA and CATÁLOGO values can be checked?
7. **Corrections scope:** per list only (like AnyList), or across all your lists (like OurGroceries)? Different lists may be different stores.
8. **Packaging:** OK to keep the dictionary inside `index.html` until offline caching (a service worker) is added? The MQTT library also loads from unpkg without a pinned version; that is a separate offline and robustness task.
9. **Bigger labeling test:** does Qwen's 36-37/40 hold on about 300 real, independently labeled items? Worth one run (about 3-4 minutes) before the dictionary build.

---

## Claim ledger (draft claim → status)

| ID | Topic | Status | Note |
|---|---|---|---|
| C01 | 1,720 pairs / 1,659 keys / 57 dups / 50 conflicts | CONFIRMED | Re-counted |
| C02 | 75 accented keys never match | CONFIRMED | 67 have no twin |
| C03 | NFD splits ñ | CONFIRMED | `jsc` test |
| C04 | Substring misfires | CONFIRMED | Exact JS in `jsc` |
| C05 | 19 → 26, 15 → 5 | CORRECTED | Not all misses are vocabulary |
| C06 | 138 cross-aisle typo pairs | CONFIRMED | Re-run |
| C07 | Library sizes | CORRECTED | fastest-levenshtein raw 3.8 KB |
| C08 | Stemmer package sizes | CONFIRMED | natural, nlpjs re-measured; snowball-stemmers not re-measured |
| C09 | Snowball too aggressive | CONFIRMED | - |
| C10 | Plural rules (RAE) | UNVERIFIED | RAE 403; approach works locally |
| C11 | Reminders Spanish, iOS 18 | CONFIRMED | 2025-12-09 |
| C12 | Reminders sections complaint | CONFIRMED | 32 "me too" |
| C13 | Reminders manual fix | CONFIRMED | 2024-09-18, iOS 17 |
| C14 | AnyList category sets | CONFIRMED | - |
| C15 | AnyList v5.9 shared memory | CONFIRMED | Source refined |
| C16 | OurGroceries | CONFIRMED | - |
| C17 | Bring! | CONFIRMED | Only custom items recategorizable |
| C18 | Listonic | CONFIRMED | 2025-10-02 |
| C19 | Google Keep / Gemini | CONFIRMED | 2026-08-23 |
| C20 | AisleMate | UNVERIFIED | Not re-checked |
| C21 | Store layout (US) | CONFIRMED | 2024-02-04 |
| C22 | Samsung Internet no DnD | CONFIRMED | Also Firefox Android |
| C23 | OFF licences | CONFIRMED | - |
| C24 | OFF taxonomy counts | CORRECTED | See corrections |
| C25 | PROFECO QQP CC BY 4.0, 2026-09-22 | CONFIRMED | CSV contents unverified |
| C26 | Google taxonomy es-ES only | CONFIRMED | es-MX, es-419 404 |
| C27 | Retailer department names | CONFIRMED (partly) | "Panadería y Tortillería" not seen in today's fetch |
| C28 | Embedding model sizes | CONFIRMED | + tokenizer sizes |
| C29 | Bekko a8m 124 MiB | CONFIRMED | 2026-07-28 |
| C30 | ORT WASM sizes | CONFIRMED | 3.1-5.5 MB brotli |
| C31 | Transformers.js v4 | CONFIRMED | 2026-02-09 |
| C32 | Safari 26 WebGPU on iOS | CONFIRMED | 2025-09-15 |
| C33 | Mercari LLM + kNN | CONFIRMED | 2024-05-31 (old) |
| C34 | Zero-shot LLM 64-77% | UNVERIFIED | Accuracy figures not visible; task (248 × 20) confirmed |
| C35 | Qwen 37/40 | CONFIRMED | 27.4 s; 36/40 neutral prompt |
| C36 | llama-server json_schema | CONFIRMED | README + local run |
| C37 | LLM regional Spanish bias | CONFIRMED | 2026-02-10 study; 2025 dataset not re-checked |
| C38 | 700-item classifier 61% | CONFIRMED | 2025-09-18 |
| C39 | Dictionary sizes | CONFIRMED | 5,000-term figure is an estimate |
| C40 | `jsc` / `osascript` available, no Node | CONFIRMED | macOS 27.0 |
| C41 | Sal de Uvas = antacid | CONFIRMED | Chedraui: Farmacia > Estomacales |
| C42 | FastText.zip ~100x smaller | CONFIRMED | 2016 (old) |

---

## Sources

**Local evidence (2026-09-25)**
- `index.html` on branch `design/checkpoint-1` (commit `2e5bc85`): lines 241-257 (dictionary), 451-468 (matcher), 471-492 (`addItem`), 652 (alphabetical aisles).
- Scratchpad scripts (temporary, this session): `proto.py`, `tests.py`, `llm_test.py`, `an2.py`, and `verify/` (the JS re-run and the neutral-prompt Qwen run).

**Web sources**
- [Grocery lists in Reminders, Apple Support, 2025-12-09](https://support.apple.com/en-us/120616)
- [Reminders grocery sections thread, Apple Community, 2025-01-30](https://discussions.apple.com/thread/255951058)
- [iPhone grocery list sorting wrong? Here's how to fix it, iPhone Life, 2024-09-18](https://www.iphonelife.com/content/iphone-grocery-list-sorting-wrong-heres-how-to-fix-it)
- [Feature Overview: Category Sets, AnyList Help, undated (© 2026), fetched 2026-09-25](https://help.anylist.com/articles/category-sets/)
- [AnyList v5.9 Release Notes, AnyList Help, undated, fetched 2026-09-25](https://help.anylist.com/articles/release-notes-anylist-v5-9/)
- [How do I set the default category for a list?, AnyList Help, undated, fetched 2026-09-25](https://help.anylist.com/articles/default-category/)
- [User Guide, OurGroceries, undated (© 2009–2026), fetched 2026-09-25](https://www.ourgroceries.com/user-guide)
- [Items & Lists, Bring! Help Center, undated, fetched 2026-09-25](https://www.getbring.com/help-center-main-categories/items-lists)
- [Custom grocery list categories, Listonic, 2025-10-02](https://listonic.com/custom-grocery-list-categories)
- [Google Keep Gemini voice checklist, Android Police, 2026-08-23](https://www.androidpolice.com/google-keep-gemini-voice-checklist-notes/)
- [dragndrop.json, caniuse (GitHub), data updated 2026-09-24](https://github.com/Fyrd/caniuse/blob/main/features-json/dragndrop.json)
- [pointer-events.json, caniuse (GitHub), fetched 2026-09-25](https://github.com/Fyrd/caniuse/blob/main/features-json/pointer-events.json)
- [Open Food Facts data and licences, openfoodfacts.org, undated, fetched 2026-09-25](https://world.openfoodfacts.org/data)
- [categories.txt taxonomy, Open Food Facts (GitHub), last commit 2026-09-25](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/food/categories.txt)
- [Programa Quién es quién en los precios (2026), datos.gob.mx, updated 2026-09-22](https://www.datos.gob.mx/api/3/action/package_show?id=programa_quien_es_quien_precios_2026)
- [Diccionario de datos QQP, PROFECO, undated, fetched 2026-09-25](https://datos.profeco.gob.mx/diccionarioDatosQQP.php)
- [Google product taxonomy es-ES, google.com, version 2021-09-21](https://www.google.com/basepages/producttype/taxonomy-with-ids.es-ES.txt)
- [Chedraui home and navigation, chedraui.com.mx, fetched 2026-09-25](https://www.chedraui.com.mx/)
- [Antiácido Sal de Uvas Picot, Chedraui, fetched 2026-09-25](https://www.chedraui.com.mx/antiacido-sal-de-uvas-picot-efervescente-10-sobres-3038529/p)
- [Xenova/multilingual-e5-small files, Hugging Face API, 2026-09-25](https://huggingface.co/api/models/Xenova/multilingual-e5-small?blobs=true)
- [Bekko Embedding, arXiv 2607.25180, 2026-07-28](https://arxiv.org/abs/2607.25180)
- [onnxruntime-web 1.30.0 files, jsDelivr, measured 2026-09-25](https://data.jsdelivr.com/v1/packages/npm/onnxruntime-web@1.30.0?structure=flat)
- [Transformers.js v4, Hugging Face blog, 2026-02-09](https://huggingface.co/blog/transformersjs-v4)
- [WebKit Features in Safari 26.0, WebKit blog, 2025-09-15](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [The Prompt API, Chrome for Developers, updated 2026-08-26](https://developer.chrome.com/docs/ai/prompt-api)
- [Large-scale item categorization using LLM, Mercari Engineering, 2024-05-31](https://engineering.mercari.com/en/blog/entry/20240411-large-scale-item-categoraization-using-llm/)
- [Battle of LLM Giants (repo), GitHub / NLP Journal, 2025](https://github.com/Applied-AI-Research-Lab/Battle-of-LLM-Giants-GPT-vs.-Claude-Models-for-Zero-Shot-Classification-in-Ecommerce-Automation)
- [Digital Linguistic Bias in Spanish, arXiv 2602.09346, 2026-02-10](https://arxiv.org/abs/2602.09346)
- [Building a grocery classification model, dgendill.com, 2025-09-18](https://www.dgendill.com/posts/technology/2025-09-18-building-a-grocery-classification-model.html)
- [Why the dairy aisle is furthest away, Chowhound, 2024-02-04](https://www.chowhound.com/1505206/why-grocery-store-dairy-aisle-furthest-away/)
- [Spanish stemming algorithm, snowballstem.org, undated, fetched 2026-09-25](https://snowballstem.org/algorithms/spanish/stemmer.html)
- [llama.cpp server README, GitHub (master), fetched 2026-09-25](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [FastText.zip, arXiv 1612.03651, 2016-12-12 (old)](https://arxiv.org/abs/1612.03651)
- UNVERIFIED (not re-opened): [AisleMate, App Store, v1.0 2025-07-22](https://apps.apple.com/us/app/aislemate-grocery-aisle-list/id6747779925); [Plural, RAE DPD, undated (403 when fetched)](https://www.rae.es/dpd/plural)
