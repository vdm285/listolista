// Real-dictionary check: data/aisles-es-MX.txt + src/aisles.js on the tricky items in
// tests/aisles-es-MX.tsv (Mexican Spanish). Store-dependent items are reported, not counted.
// Run: tests/run.sh dictionary
load('src/aisles.js');
var MIN_CORRECT = 24;  // floor = baseline 2026-09-25 (new matcher + converted old words); raise it as words are added

function parseDict(text) {
  var dict = {};
  text.split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line[0] === '#') return;
    var i = line.indexOf(':');
    dict[line.slice(0, i).trim()] = line.slice(i + 1).split('|').map(function (t) { return t.trim(); }).filter(Boolean);
  });
  return dict;
}
var idx = ListoAisles.buildIndex(parseDict(readFile('data/aisles-es-MX.txt')));
var ok = 0, n = 0, misses = [], varies = [];
readFile('tests/aisles-es-MX.tsv').split('\n').forEach(function (line) {
  if (!line.trim() || line[0] === '#') return;
  var p = line.split('\t'), got = ListoAisles.aisleOf(p[0], idx);
  if (p[2] === '1') { varies.push(p[0] + ' -> ' + got.id + ' (listed as ' + p[1] + ')'); return; }
  n++;
  if (got.id === p[1]) ok++;
  else misses.push(p[0] + ': got ' + got.id + (got.guess ? '?' : '') + ', want ' + p[1] + (got.term ? ' (matched "' + got.term + '")' : ''));
});
print('dictionary: ' + ok + '/' + n + ' correct on tricky items (store-dependent items not counted)');
misses.forEach(function (m) { print('  MISS ' + m); });
varies.forEach(function (v) { print('  varies: ' + v); });
if (ok < MIN_CORRECT) throw new Error('below the floor of ' + MIN_CORRECT);
