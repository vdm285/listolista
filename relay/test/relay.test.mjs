// Relay tests against a running relay (default: local `wrangler dev`). Run: relay/test/run.sh
import http from 'node:http';

const BASE = process.env.RELAY || 'ws://127.0.0.1:8787';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + ' ' + extra); } };
const room = () => Array.from(crypto.getRandomValues(new Uint8Array(22)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b % 64]).join('').slice(0, 22);

function open(r) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE}/r/${r}`);
    const inbox = [];
    const waiters = [];
    ws.onmessage = e => { const m = e.data === 'pong' ? 'pong' : JSON.parse(e.data); const w = waiters.shift(); w ? w(m) : inbox.push(m); };
    ws.onerror = e => reject(e);
    ws.onopen = () => resolve({
      ws,
      next: (ms = 3000) => inbox.length ? Promise.resolve(inbox.shift())
        : new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); waiters.push(m => { clearTimeout(t); res(m); }); }),
      send: m => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
      close: () => ws.close(),
    });
  });
}

function rawUpgrade(path, origin) {
  const u = new URL(BASE.replace('ws', 'http'));
  return new Promise(resolve => {
    const req = http.request({ host: u.hostname, port: u.port, path, headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', ...(origin ? { Origin: origin } : {}) } });
    req.on('response', res => resolve(res.statusCode));
    req.on('upgrade', res => { resolve(101); res.socket?.destroy?.(); });
    req.on('error', () => resolve(0));
    req.end();
  });
}

const r1 = room(), TOK = 'secret-derived-token';
const A = await open(r1), B = await open(r1);
let m = await A.next(); ok('A gets empty snap', m.t === 'snap' && m.v === 0 && m.blob === null, JSON.stringify(m));
m = await B.next(); ok('B gets empty snap', m.t === 'snap' && m.v === 0, JSON.stringify(m));

A.send({ t: 'put', base: 0, blob: 'blob-1', tok: TOK });
m = await A.next(); ok('A sees v1', m.t === 'snap' && m.v === 1 && m.blob === 'blob-1', JSON.stringify(m));
m = await B.next(); ok('B receives v1 instantly', m.t === 'snap' && m.v === 1 && m.blob === 'blob-1', JSON.stringify(m));

B.send({ t: 'put', base: 0, blob: 'stale', tok: TOK });
m = await B.next(); ok('stale base -> conflict with current', m.t === 'conflict' && m.v === 1 && m.blob === 'blob-1', JSON.stringify(m));

B.send({ t: 'put', base: 1, blob: 'blob-2', tok: TOK });
m = await B.next(); ok('B v2 accepted', m.t === 'snap' && m.v === 2, JSON.stringify(m));
m = await A.next(); ok('A receives v2', m.t === 'snap' && m.v === 2 && m.blob === 'blob-2', JSON.stringify(m));

A.send({ t: 'put', base: 2, blob: 'evil', tok: 'wrong-token' });
m = await A.next(); ok('wrong token -> forbidden', m.t === 'err' && m.code === 'forbidden', JSON.stringify(m));

A.send({ t: 'put', base: 2, blob: 'x'.repeat(64 * 1024 + 1), tok: TOK });
m = await A.next(); ok('too big', m.t === 'err' && m.code === 'too_big', JSON.stringify(m));

A.send('not json');
m = await A.next(); ok('bad request', m.t === 'err' && m.code === 'bad_request', JSON.stringify(m));

A.send('ping');
m = await A.next(); ok('heartbeat pong', m === 'pong', JSON.stringify(m));

A.close(); B.close();
const C = await open(r1);
m = await C.next(); ok('late joiner gets latest', m.t === 'snap' && m.v === 2 && m.blob === 'blob-2', JSON.stringify(m));

// rate limit: 31 quick puts on a fresh room from one phone
const r2 = room(), D = await open(r2);
await D.next();
let v = 0, slow = false;
for (let i = 0; i < 31; i++) {
  D.send({ t: 'put', base: v, blob: 'b' + i, tok: TOK });
  const r = await D.next();
  if (r.t === 'snap') v = r.v; else if (r.t === 'err' && r.code === 'slow_down') slow = true;
}
ok('rate limit after 30 puts / 10 s', slow && v === 30, `v=${v} slow=${slow}`);
C.close(); D.close();

ok('bad room id -> 404', (await rawUpgrade('/r/short', null)) === 404);
ok('foreign website -> 403', (await rawUpgrade('/r/' + room(), 'https://evil.example')) === 403);
ok('allowed website -> 101', (await rawUpgrade('/r/' + room(), 'https://vdm285.github.io')) === 101);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
