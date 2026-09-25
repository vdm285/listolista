// Tests for src/sync.js: encryption (always) and live sync through a relay (when RELAY is set).
// Run: relay/test/run.sh (starts a local relay and sets RELAY), or `node tests/sync.test.mjs`.
import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync(new URL('../src/sync.js', import.meta.url), 'utf8'));
const S = globalThis.ListoSync;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + ' ' + extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function throws(fn) { try { await fn(); return false; } catch { return true; } }

// ---- keys ----
const secret = S.newSecret();
ok('secret is 22 chars', secret.length === 22, secret);
const k1 = await S.derive(secret), k1b = await S.derive(secret), k2 = await S.derive(S.newSecret());
ok('room id 22 chars', /^[A-Za-z0-9_-]{22}$/.test(k1.roomId), k1.roomId);
ok('derive is deterministic', k1.roomId === k1b.roomId && k1.tok === k1b.tok);
ok('different secret, different room', k1.roomId !== k2.roomId && k1.tok !== k2.tok);
ok('room id does not reveal the secret', !k1.roomId.includes(secret.slice(0, 8)));
ok('bad secret rejected', await throws(() => S.derive('short')));

// ---- sealing ----
const state = { meta: { title: 'SÚPER', timestamp: 1 }, items: [{ id: 1, text: 'huevos', done: false, timestamp: 1 }] };
const b1 = await S.seal(k1, state), b2 = await S.seal(k1, state);
ok('round trip', JSON.stringify(await S.open(k1, b1)) === JSON.stringify(state));
ok('fresh IV each time', b1 !== b2);
ok('no plaintext in blob', !b1.includes('huevos') && !b1.includes('SÚPER'));
const small = await S.seal(k1, { items: [] }), bigger = await S.seal(k1, { items: [{ id: 1, text: 'x'.repeat(300) }] });
ok('padding hides small size differences', small.length === bigger.length, small.length + ' vs ' + bigger.length);
const parts = b1.split('.'); const bad = parts[0] + '.' + parts[1] + '.' + (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
ok('tampered blob rejected', await throws(() => S.open(k1, bad)));
ok('wrong key rejected', await throws(() => S.open(k2, b1)));
ok('blob moved to another room rejected', await throws(() => S.open({ ...k1, roomId: k2.roomId }, b1)));

// ---- live sync through the relay ----
if (process.env.RELAY) {
  // A tiny per-item "newest wins" merge, standing in for src/merge.js in this test.
  function merge(local, remote) {
    const map = new Map(local.items.map(i => [i.id, i]));
    let changed = false, localNewer = false;
    for (const r of remote.items || []) { const l = map.get(r.id); if (!l || r.timestamp > l.timestamp) { map.set(r.id, r); changed = true; } }
    const rids = new Map((remote.items || []).map(i => [i.id, i]));
    for (const l of local.items) { const r = rids.get(l.id); if (!r || l.timestamp > r.timestamp) localNewer = true; }
    return { state: { ...local, items: [...map.values()] }, changed, localNewer };
  }
  function phone(keys) {
    const p = { state: { meta: { title: 'L', timestamp: 0 }, items: [] }, online: false };
    p.relay = new S.Relay(process.env.RELAY, keys, {
      onRemote: st => { const m = merge(p.state, st); p.state = m.state; if (m.localNewer) p.relay.put(p.state); },
      onStatus: s => { p.online = s === 'online'; },
      onError: c => { p.err = c; },
    });
    p.add = (id, text) => { p.state = { ...p.state, items: [...p.state.items, { id, text, done: false, timestamp: Date.now() + id }] }; p.relay.put(p.state); };
    p.texts = () => p.state.items.map(i => i.text).sort().join(',');
    return p;
  }
  const kk = await S.derive(S.newSecret());
  const A = phone(kk), B = phone(kk);
  for (let i = 0; i < 50 && !(A.online && B.online); i++) await sleep(100);
  ok('both phones online', A.online && B.online);

  A.add(1, 'huevos');
  let t0 = Date.now();
  for (let i = 0; i < 50 && B.texts() !== 'huevos'; i++) await sleep(50);
  ok('B receives A\'s item', B.texts() === 'huevos', B.texts());
  const ms = Date.now() - t0;
  ok('delivery under 1 s locally', ms < 1000, ms + ' ms');

  // both edit at the same moment from the same version: one conflict, then both converge
  A.add(2, 'leche'); B.add(3, 'pan');
  for (let i = 0; i < 60 && !(A.texts() === 'huevos,leche,pan' && B.texts() === 'huevos,leche,pan'); i++) await sleep(50);
  ok('simultaneous edits converge', A.texts() === 'huevos,leche,pan' && B.texts() === 'huevos,leche,pan', A.texts() + ' | ' + B.texts());

  // a third phone with the same link joins later and gets everything
  const C = phone(kk);
  for (let i = 0; i < 60 && C.texts() !== 'huevos,leche,pan'; i++) await sleep(50);
  ok('late phone gets the full list', C.texts() === 'huevos,leche,pan', C.texts());

  // a phone with a different link sees nothing
  const D = phone(await S.derive(S.newSecret()));
  await sleep(700);
  ok('other link sees nothing', D.texts() === '', D.texts());

  // reconnect after "waking up" keeps working
  B.relay.reconnectNow();
  for (let i = 0; i < 50 && !B.online; i++) await sleep(100);
  A.add(4, 'queso');
  for (let i = 0; i < 60 && !B.texts().includes('queso'); i++) await sleep(50);
  ok('sync after reconnect', B.texts().includes('queso'), B.texts());

  ok('no errors reported', !A.err && !B.err && !C.err && !D.err, [A.err, B.err, C.err, D.err].join());
  for (const p of [A, B, C, D]) p.relay.close();
} else {
  console.log('(RELAY not set: live sync tests skipped)');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
