// ListoLista sync: end-to-end encryption + the phone side of the relay connection.
// Plain script (no modules, no libraries): defines the global `ListoSync`. Browser and Node 22+.
//
// A shared list's link carries a random 128-bit secret after '#k=' (browsers never send the part
// after '#' to any server). From it each phone derives, locally:
//   roomId  22 characters, SHA-256 of the secret: names the list on the relay
//   key     AES-GCM-256 via HKDF: encrypts the whole list (title, items, flags)
//   tok     128-bit write token via HKDF: the relay only accepts writes carrying it
// The relay stores and forwards only opaque blobs "v1.<iv>.<ciphertext>" (padded to 1 KB steps,
// so it can't even count items).
var ListoSync = (function () {
  'use strict';
  var enc = new TextEncoder(), dec = new TextDecoder();
  var PAD = 1024;

  function b64u(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }

  function newSecret() { return b64u(crypto.getRandomValues(new Uint8Array(16))); }

  async function derive(secret) {
    var raw = unb64u(secret);
    if (raw.length !== 16) throw new Error('bad secret');
    var h = await crypto.subtle.digest('SHA-256', concat(enc.encode('listolista/room/v1'), raw));
    var roomId = b64u(h).slice(0, 22);
    var ikm = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey', 'deriveBits']);
    var salt = enc.encode('listolista');
    var key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: enc.encode('aes-gcm-256/v1') },
      ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    var tokBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: enc.encode('write-token/v1') }, ikm, 128);
    return { roomId: roomId, key: key, tok: b64u(tokBits) };
  }

  function pad(bytes) {
    var n = 4 + bytes.length, size = Math.ceil(n / PAD) * PAD, out = new Uint8Array(size);
    new DataView(out.buffer).setUint32(0, bytes.length);
    out.set(bytes, 4);
    return out;
  }
  function unpad(bytes) {
    var len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (len > bytes.length - 4) throw new Error('bad padding');
    return bytes.subarray(4, 4 + len);
  }

  async function seal(keys, state) {
    var iv = crypto.getRandomValues(new Uint8Array(12));   // fresh IV for every message
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: enc.encode(keys.roomId) },
      keys.key, pad(enc.encode(JSON.stringify(state))));
    return 'v1.' + b64u(iv) + '.' + b64u(ct);
  }

  async function open(keys, blob) {
    var p = String(blob).split('.');
    if (p.length !== 3 || p[0] !== 'v1') throw new Error('unknown format');
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(p[1]), additionalData: enc.encode(keys.roomId) },
      keys.key, unb64u(p[2]));
    return JSON.parse(dec.decode(unpad(new Uint8Array(pt))));
  }

  // Phone side of the relay. handlers: onRemote(state) -> called with every decrypted copy from
  // the relay, or with null when the relay holds nothing yet (the app merges it and calls put()
  // again if it holds newer changes);
  // onStatus('connecting'|'online'|'offline'); onError(code).
  function Relay(baseUrl, keys, handlers) {
    var self = this;
    var ws = null, v = 0, synced = false, pending = null, lastSent = null, sending = false, closed = false;
    var retry = 0, hb = null, pongTimer = null, retryTimer = null, sendTimer = null;
    var status = function (s) { if (handlers.onStatus) handlers.onStatus(s); };

    function connect() {
      if (closed) return;
      clearTimeout(retryTimer);
      status('connecting');
      var sock;
      try { sock = new WebSocket(baseUrl.replace(/\/$/, '') + '/r/' + keys.roomId); }
      catch (e) { return schedule(); }
      ws = sock;
      // Every handler first checks that its socket is still the current one (old sockets are ignored).
      sock.onopen = function () { if (sock !== ws) return; retry = 0; status('online'); heartbeat(); };
      sock.onmessage = function (e) {
        if (sock !== ws || closed) return;
        if (e.data === 'pong') { clearTimeout(pongTimer); return; }
        var m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'snap' || m.t === 'conflict') {
          clearTimeout(sendTimer);
          v = m.v; synced = true; sending = false;
          if (m.t === 'snap' && lastSent && m.blob === lastSent) lastSent = null;   // our own change came back: done
          var done = function () { flush(); };
          if (m.blob) {
            open(keys, m.blob).then(function (st) { if (sock === ws && !closed) handlers.onRemote(st); }, function () {
              if (handlers.onError) handlers.onError('decrypt');
            }).then(done);
          } else { handlers.onRemote(null); done(); }   // nothing stored yet: the app may upload
        } else if (m.t === 'err') {
          clearTimeout(sendTimer);
          sending = false;
          if (m.code === 'slow_down' && lastSentState) { pending = pending || lastSentState; setTimeout(flush, 3000); }
          if (handlers.onError) handlers.onError(m.code);
        }
      };
      sock.onclose = function () {
        if (sock !== ws) return;
        stopHeartbeat(); clearTimeout(sendTimer); synced = false;
        if (sending && lastSentState) pending = pending || lastSentState;   // resend after reconnect
        sending = false; status('offline'); schedule();
      };
      sock.onerror = function () { if (sock === ws) { try { sock.close(); } catch (e) {} } };
    }
    function schedule() {
      if (closed) return;
      var ms = Math.min(8000, 1000 * Math.pow(2, retry++));
      retryTimer = setTimeout(connect, ms);
    }
    function heartbeat() {
      stopHeartbeat();
      hb = setInterval(function () {
        if (!ws || ws.readyState !== 1) return;
        ws.send('ping');
        clearTimeout(pongTimer);
        pongTimer = setTimeout(function () { self.reconnectNow(); }, 8000);
      }, 20000);
    }
    function stopHeartbeat() { clearInterval(hb); clearTimeout(pongTimer); }

    // Send the newest local state once the relay has told us its current version.
    var lastSentState = null;
    function flush() {
      if (!pending || sending || !synced || !ws || ws.readyState !== 1) return;
      var st = pending, sock = ws; pending = null; sending = true;
      seal(keys, st).then(function (blob) {
        if (sock !== ws || sock.readyState !== 1) { pending = pending || st; sending = false; return; }
        lastSent = blob; lastSentState = st;
        sock.send(JSON.stringify({ t: 'put', base: v, blob: blob, tok: keys.tok }));
        // No answer within 6 s: the connection is probably dead even if it looks open.
        clearTimeout(sendTimer);
        sendTimer = setTimeout(function () { if (sock === ws && sending) self.reconnectNow(); }, 6000);
      });
    }

    self.put = function (state) { pending = state; flush(); };
    self.reconnectNow = function () {   // e.g. when the phone wakes up: always a fresh connection
      if (closed) return;
      retry = 0;
      var old = ws; ws = null;
      if (old) { try { old.close(); } catch (e) {} }
      stopHeartbeat(); clearTimeout(sendTimer); clearTimeout(retryTimer);
      if (sending && lastSentState) pending = pending || lastSentState;
      synced = false; sending = false;
      connect();
    };
    self.close = function () {
      closed = true; stopHeartbeat(); clearTimeout(retryTimer); clearTimeout(sendTimer);
      var old = ws; ws = null; if (old) try { old.close(); } catch (e) {}
    };
    self.version = function () { return v; };
    connect();
  }

  return { newSecret: newSecret, derive: derive, seal: seal, open: open, Relay: Relay, _b64u: b64u, _unb64u: unb64u };
})();
if (typeof globalThis !== 'undefined') globalThis.ListoSync = ListoSync;
