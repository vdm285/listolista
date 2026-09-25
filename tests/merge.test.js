// Tests for src/merge.js (spec at the top of that file). Run: tests/run.sh
// PROTECTED: don't change this file to make code pass; change the code.
load('src/merge.js');

var pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; print('FAIL ' + name + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}
if (typeof ListoMerge.merge !== 'function') throw new Error('ListoMerge.merge must be a function');
var M = ListoMerge.merge;

function it(id, text, ts, extra) {
  var o = { id: id, text: text, done: false, deleted: false, timestamp: ts };
  for (var k in (extra || {})) o[k] = extra[k];
  return o;
}
function S(items, meta, more) {
  var s = { items: items, meta: meta || { title: 'SUPER', timestamp: 1 } };
  for (var k in (more || {})) s[k] = more[k];
  return s;
}
var texts = function (r) { return r.state.items.map(function (i) { return i.text + (i.done ? '*' : '') + (i.deleted ? '~' : ''); }); };

// identical copies
var a = S([it(1, 'huevos', 10), it(2, 'leche', 11)]);
var r = M(a, JSON.parse(JSON.stringify(a)));
eq('identical: items', texts(r), ['huevos', 'leche']);
eq('identical: flags', [r.changed, r.localNewer], [false, false]);

// remote adds an item
r = M(S([it(1, 'huevos', 10)]), S([it(1, 'huevos', 10), it(2, 'leche', 12)]));
eq('remote adds: items', texts(r), ['huevos', 'leche']);
eq('remote adds: flags', [r.changed, r.localNewer], [true, false]);

// local has an item remote lacks
r = M(S([it(1, 'huevos', 10), it(3, 'pan', 13)]), S([it(1, 'huevos', 10)]));
eq('local extra: items', texts(r), ['huevos', 'pan']);
eq('local extra: flags', [r.changed, r.localNewer], [false, true]);

// both added different items (the offline race)
r = M(S([it(1, 'huevos', 10), it(3, 'pan', 13)]), S([it(1, 'huevos', 10), it(4, 'queso', 14)]));
eq('both added: items', texts(r), ['huevos', 'pan', 'queso']);
eq('both added: flags', [r.changed, r.localNewer], [true, true]);

// newer timestamp wins per item
r = M(S([it(1, 'huevos', 10)]), S([it(1, 'huevos', 20, { done: true })]));
eq('remote newer strike', texts(r), ['huevos*']);
eq('remote newer flags', [r.changed, r.localNewer], [true, false]);
r = M(S([it(1, 'huevos', 30, { deleted: true })]), S([it(1, 'huevos', 20, { done: true })]));
eq('local newer delete', texts(r), ['huevos~']);
eq('local newer flags', [r.changed, r.localNewer], [false, true]);

// tie keeps local
r = M(S([it(1, 'huevos', 10, { text: 'huevos rojos' })]), S([it(1, 'huevos', 10)]));
eq('tie keeps local', texts(r), ['huevos rojos']);
eq('tie flags', [r.changed, r.localNewer], [false, false]);

// order: local order kept, remote-only appended in remote order
r = M(S([it(5, 'e', 1), it(2, 'b', 1)]), S([it(9, 'z', 1), it(2, 'b', 1), it(7, 'x', 1)]));
eq('order', texts(r), ['e', 'b', 'z', 'x']);

// meta
r = M(S([], { title: 'A', timestamp: 5 }), S([], { title: 'B', timestamp: 9 }));
eq('meta remote newer', [r.state.meta.title, r.changed, r.localNewer], ['B', true, false]);
r = M(S([], { title: 'A', timestamp: 9 }), S([], { title: 'B', timestamp: 5 }));
eq('meta local newer', [r.state.meta.title, r.changed, r.localNewer], ['A', false, true]);
r = M(S([], { title: 'A', timestamp: 5 }), S([], { title: 'B', timestamp: 5 }));
eq('meta tie', [r.state.meta.title, r.changed, r.localNewer], ['A', false, false]);

// aisle corrections (ovr): per key
var L = S([], null, { ovr: { 'pan molido': { aisle: 'DES', ts: 5 }, 'papas': { aisle: 'FRU', ts: 9 } } });
var R = S([], null, { ovr: { 'pan molido': { aisle: 'PAN', ts: 7 }, 'carnitas': { aisle: 'CAR', ts: 3 } } });
r = M(L, R);
eq('ovr merged', r.state.ovr, { 'pan molido': { aisle: 'PAN', ts: 7 }, 'papas': { aisle: 'FRU', ts: 9 }, 'carnitas': { aisle: 'CAR', ts: 3 } });
eq('ovr flags', [r.changed, r.localNewer], [true, true]);
r = M(S([]), S([]));
eq('ovr omitted when absent', 'ovr' in r.state, false);

// aisle order: whole object
r = M(S([], null, { order: { ids: ['FRU', 'PAN'], ts: 4 } }), S([], null, { order: { ids: ['PAN', 'FRU'], ts: 6 } }));
eq('order remote newer', r.state.order.ids, ['PAN', 'FRU']);
r = M(S([], null, { order: { ids: ['FRU', 'PAN'], ts: 4 } }), S([]));
eq('order local only', [r.state.order.ids, r.localNewer], [['FRU', 'PAN'], true]);

// missing pieces and null remote
r = M(S([it(1, 'huevos', 10)]), null);
eq('null remote', [texts(r), r.changed, r.localNewer], [['huevos'], false, true]);
r = M(S([it(1, 'huevos', 10)]), { meta: { title: 'X', timestamp: 0 } });
eq('remote without items', [texts(r), r.changed, r.localNewer], [['huevos'], false, true]);
r = M(S([it(1, 'huevos', undefined)]), S([it(1, 'huevos', 3, { done: true })]));
eq('missing timestamp counts as 0', texts(r), ['huevos*']);

// other local fields kept
r = M(S([], null, { extra: 42 }), S([]));
eq('other fields kept', r.state.extra, 42);

// inputs not modified
var li = S([it(1, 'huevos', 10)]), ri = S([it(1, 'huevos', 20, { done: true }), it(2, 'leche', 5)]);
var before = JSON.stringify([li, ri]);
M(li, ri);
eq('inputs untouched', JSON.stringify([li, ri]), before);

print(pass + ' passed, ' + fail + ' failed');
if (fail > 0) throw new Error(fail + ' test(s) failed');
