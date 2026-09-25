#!/usr/bin/env python3
"""Check data/aisles-es-MX.txt: known aisle IDs, folded terms, no word in two aisles.
Exit 1 on problems. Run after editing the dictionary."""
import re, sys, unicodedata
IDS = {"FRU", "PAN", "CAR", "LAC", "CON", "DES", "BOT", "BEB", "LIM", "HIG", "FAR", "BBE", "MAS"}
def fold(t):
    t = ''.join(ch for ch in unicodedata.normalize('NFD', t) if not unicodedata.category(ch).startswith('M')).lower()
    t = re.sub(r'(\d)[.,](?=\d)', lambda m: m.group(1) + '\0', t)
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9/\0]+', ' ', t).replace('\0', '.')).strip()
problems, where, n = [], {}, 0
for ln, line in enumerate(open(sys.argv[1] if len(sys.argv) > 1 else 'data/aisles-es-MX.txt', encoding='utf-8'), 1):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    if ':' not in line:
        problems.append(f"line {ln}: missing 'ID:'"); continue
    aid, terms = line.split(':', 1)
    aid = aid.strip()
    if aid not in IDS:
        problems.append(f"line {ln}: unknown aisle id {aid!r}")
    for t in [t.strip() for t in terms.split('|') if t.strip()]:
        n += 1
        if fold(t) != t:
            problems.append(f"line {ln}: {t!r} is not folded (use {fold(t)!r})")
        if t in where and where[t] != aid:
            problems.append(f"{t!r} is in both {where[t]} and {aid}")
        where[t] = aid
print(f"{n} terms, {len(problems)} problem(s)")
for p in problems[:50]:
    print("  " + p)
sys.exit(1 if problems else 0)
