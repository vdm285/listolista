#!/usr/bin/env python3
"""Build the single-file app: src/app.html + src/*.js + data/aisles-es-MX.txt -> index.html.

Usage: python3 tools/build.py [--relay wss://listolista-relay.<account>.workers.dev]
The relay URL is kept from the previous build when not given (read back from index.html).
Users still get ONE file (index.html); we edit small, tested parts in src/.
"""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
relay = None
if '--relay' in sys.argv:
    relay = sys.argv[sys.argv.index('--relay') + 1]
else:
    old = (root / 'index.html').read_text(encoding='utf-8') if (root / 'index.html').exists() else ''
    m = re.search(r'var LISTO_RELAY = "([^"]*)";', old)
    relay = m.group(1) if m else ''
if relay and not re.match(r'^wss://[A-Za-z0-9.-]+(/[A-Za-z0-9._/-]*)?$', relay):
    sys.exit('relay must look like wss://host')

html = (root / 'src' / 'app.html').read_text(encoding='utf-8')
def include(m):
    code = (root / m.group(1)).read_text(encoding='utf-8')
    if '</script' in code.lower():
        sys.exit(f'{m.group(1)} contains "</script" and cannot be inlined')
    return code
html = re.sub(r'/\*@include ([\w./-]+)\*/', include, html)
dict_text = (root / 'data' / 'aisles-es-MX.txt').read_text(encoding='utf-8')
html = html.replace('/*@dict*/', json.dumps(dict_text, ensure_ascii=False).replace('</', '<\\/'))
html = html.replace('/*@relay*/', relay)
if '/*@' in html:
    sys.exit('unreplaced placeholder left in the page')
(root / 'index.html').write_text(html, encoding='utf-8')
import hashlib
version = hashlib.sha256(html.encode()).hexdigest()[:10]
sw = (root / 'src' / 'sw.js').read_text(encoding='utf-8').replace('/*@version*/', version)
(root / 'sw.js').write_text(sw, encoding='utf-8')
print(f'index.html: {len(html.encode()):,} bytes; sw.js cache {version}; relay = {relay or "(none: shared lists stay offline)"}')
