#!/usr/bin/env python3
"""One-off (2026-09-25): convert the dictionary inside index.html to data/aisles-es-MX.txt
with aisle IDs, plus data/aisles-review.md listing conflicting duplicates."""
import re, unicodedata, collections, sys
s = open('index.html', encoding='utf-8').read()
body = s[s.index('const SUPERMARKET_DICT'):s.index('const App')]
pairs = re.findall(r'"([^"]+)":\s*"([^"]+)"', body)
CAT = {"Frutas y Verduras": "FRU", "Carnes y Pescados": "CAR", "Lácteos y Huevos": "LAC",
       "Panadería y Tortillas": "PAN", "Despensa y Abarrotes": "DES", "Bebidas": "BEB",
       "Botanas y Dulces": "BOT", "Limpieza y Hogar": "LIM", "Higiene Personal": "HIG",
       "Mascotas": "MAS", "Farmacia": "FAR", "Bebés": "BBE"}
ORDER = ["FRU", "PAN", "CAR", "LAC", "CON", "DES", "BOT", "BEB", "LIM", "HIG", "FAR", "BBE", "MAS"]

def cat_id(c):
    for k, v in CAT.items():
        if c.startswith(k):
            return v
    sys.exit("unknown category " + c)

def fold(t):   # same rules as ListoAisles.fold in src/aisles.js
    t = ''.join(ch for ch in unicodedata.normalize('NFD', t) if not unicodedata.category(ch).startswith('M')).lower()
    t = re.sub(r'(\d)[.,](?=\d)', lambda m: m.group(1) + '\0', t)
    t = re.sub(r'[^a-z0-9/\0]+', ' ', t).replace('\0', '.')
    return re.sub(r'\s+', ' ', t).strip()

final, seen = {}, collections.defaultdict(list)
for k, c in pairs:
    fk, cid = fold(k), cat_id(c)
    seen[fk].append(cid)
    final[fk] = cid                      # last one wins, as in the old JS object literal
conflicts = {k: v for k, v in seen.items() if len(set(v)) > 1}
by = collections.defaultdict(list)
for k, cid in final.items():
    by[cid].append(k)
head = ["# ListoLista aisle dictionary, Mexican Spanish.",
        "# One line per aisle: ID: term|term|...  Terms are folded (lowercase, no accents); several words allowed.",
        "# The matcher (src/aisles.js) prefers the longest phrase, then the leftmost word.",
        "# After editing, run: python3 tools/check-dict.py",
        "# Converted 2026-09-25 from the dictionary inside index.html (last duplicate wins, as before);",
        "# conflicting duplicates to confirm are listed in data/aisles-review.md.", ""]
lines = head + [cid + ": " + "|".join(sorted(by.get(cid, []))) for cid in ORDER]
open('data/aisles-es-MX.txt', 'w', encoding='utf-8').write("\n".join(lines) + "\n")
rv = ["# Aisle dictionary: words to review (2026-09-25)", "",
      "These words appeared more than once in the old dictionary with different aisles. The later entry",
      "won (as in the old app). Confirm or correct them for your store in data/aisles-es-MX.txt.", "",
      "| word | aisles in the old dictionary (in order) | kept |", "|---|---|---|"]
rv += [f"| {k} | {' → '.join(v)} | **{final[k]}** |" for k, v in sorted(conflicts.items())]
open('data/aisles-review.md', 'w', encoding='utf-8').write("\n".join(rv) + "\n")
print(f"{len(pairs)} pairs -> {len(final)} folded terms; {len(conflicts)} conflicting words")
print({c: len(by.get(c, [])) for c in ORDER})
