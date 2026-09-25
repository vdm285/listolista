// ListoLista relay: a Cloudflare Worker + one Durable Object per shared list.
// It only ever sees encrypted blobs: phones encrypt with a key derived from the secret in the
// share link (the part after '#', which browsers never send to servers).
//
// Protocol (JSON over one WebSocket per phone, URL /r/<roomId>):
//   server -> phone  {t:'snap', v, blob}        current version and blob (on connect and after
//                                                every accepted change, to every phone)
//   phone -> server  {t:'put', base, blob, tok}  accepted only if base === current v
//   server -> phone  {t:'conflict', v, blob}     someone changed it first: merge and retry
//   server -> phone  {t:'err', code}             too_big | forbidden | slow_down | bad_request
//   "ping" -> "pong"                             heartbeat, answered without waking the object
// tok: a write token derived from the link secret. The first write stores its hash; later
// writes must match, so knowing only the room id is not enough to overwrite a list.
// Lists untouched for 180 days are deleted (no clutter left behind).
import { DurableObject } from 'cloudflare:workers';

const ROOM_RE = /^[A-Za-z0-9_-]{22}$/;
const MAX_BLOB = 64 * 1024;          // characters of base64url ciphertext
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_PUTS = 30;            // per phone per window
const TTL_MS = 180 * 24 * 3600 * 1000;

function allowedOrigin(env, origin) {
  if (!origin) return true;          // non-browser clients; the check only stops other websites
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    const m = url.pathname.match(/^\/r\/([^/]+)$/);
    if (!m || !ROOM_RE.test(m[1])) return new Response('not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    if (!allowedOrigin(env, request.headers.get('Origin'))) return new Response('forbidden', { status: 403 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
    return room.fetch(request);
  },
};

async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ t0: Date.now(), n: 0 });
    const { v, blob } = await this.read();
    server.send(JSON.stringify({ t: 'snap', v, blob }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async read() {
    const s = await this.ctx.storage.get(['v', 'blob', 'tokh']);
    return { v: s.get('v') || 0, blob: s.get('blob') || null, tokh: s.get('tokh') || null };
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)); }
    catch { return ws.send(JSON.stringify({ t: 'err', code: 'bad_request' })); }
    if (msg.t !== 'put') return ws.send(JSON.stringify({ t: 'err', code: 'bad_request' }));

    const a = ws.deserializeAttachment() || { t0: Date.now(), n: 0 };
    const now = Date.now();
    if (now - a.t0 > RATE_WINDOW_MS) { a.t0 = now; a.n = 0; }
    a.n++;
    ws.serializeAttachment(a);
    if (a.n > RATE_MAX_PUTS) return ws.send(JSON.stringify({ t: 'err', code: 'slow_down' }));

    if (typeof msg.blob !== 'string' || typeof msg.tok !== 'string' || !Number.isInteger(msg.base)) {
      return ws.send(JSON.stringify({ t: 'err', code: 'bad_request' }));
    }
    if (msg.blob.length > MAX_BLOB) return ws.send(JSON.stringify({ t: 'err', code: 'too_big' }));

    const cur = await this.read();
    const tokh = await sha256hex(msg.tok);
    if (cur.tokh && cur.tokh !== tokh) return ws.send(JSON.stringify({ t: 'err', code: 'forbidden' }));
    if (msg.base !== cur.v) return ws.send(JSON.stringify({ t: 'conflict', v: cur.v, blob: cur.blob }));

    const v = cur.v + 1;
    await this.ctx.storage.put({ v, blob: msg.blob, tokh });
    await this.ctx.storage.setAlarm(now + TTL_MS);
    const out = JSON.stringify({ t: 'snap', v, blob: msg.blob });
    for (const s of this.ctx.getWebSockets()) { try { s.send(out); } catch {} }
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch {}
  }

  async alarm() {
    await this.ctx.storage.deleteAll();   // untouched for 180 days: remove it
  }
}
