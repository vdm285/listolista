// ListoLista app (checkpoint 1). Uses ListoAisles (src/aisles.js), ListoMerge (src/merge.js),
// ListoSync (src/sync.js). Built into index.html by tools/build.py.
//
// Principles (AGENTS.md): open straight into the list; few clear choices; optional features load
// only when used; no accounts; the share link is the key; zero running cost.
(function () {
  'use strict';

  // ---------- small helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return Date.now(); };
  function rid(n) {
    var b = new Uint8Array(n || 8); crypto.getRandomValues(b);
    return Array.from(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  var K = { index: 'll2_lists', last: 'll2_last', device: 'll2_device', hints: 'll2_hints', v1map: 'll2_v1map',
            list: function (id) { return 'll2_list_' + id; } };
  var DEVICE = store.get(K.device) || (function () { var d = rid(6); store.set(K.device, d); return d; })();
  var isLocalDev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var RELAY = isLocalDev ? 'ws://127.0.0.1:8787' : (typeof LISTO_RELAY === 'string' ? LISTO_RELAY : '');

  function emptyState(title) { return { meta: { title: title || 'LISTA', timestamp: 0 }, items: [], ovr: {} }; }
  // Every edit must beat the version it was made on, even if this phone's clock is behind.
  function bump(old) { return Math.max(now(), (old || 0) + 1); }
  var TOMBSTONE_DAYS = 60;    // deleted items are forgotten after this; keeps shared lists small forever
  var ID_RE = /^[A-Za-z0-9-]{1,40}$/, KEY_RE = /^[a-z0-9 .\/]{1,120}$/;

  // Anything read from storage or the network is checked and trimmed before use.
  function sanitize(st) {
    if (!st || typeof st !== 'object') return null;
    var max = now() + 24 * 3600 * 1000, seen = Object.create(null), items = [];
    var num = function (v) { v = Number(v); return isFinite(v) && v > 0 ? Math.min(v, max) : 0; };
    (Array.isArray(st.items) ? st.items : []).forEach(function (i) {
      if (!i || typeof i !== 'object') return;
      var id = typeof i.id === 'number' ? String(i.id) : i.id;
      if (typeof id !== 'string' || !ID_RE.test(id) || seen[id]) return;
      seen[id] = true;
      if (i.deleted === true && typeof i.text !== 'string') { items.push({ id: id, deleted: true, timestamp: num(i.timestamp) }); return; }
      if (typeof i.text !== 'string' || !i.text.trim()) return;
      var it = { id: id, text: i.text.slice(0, 300), done: !!i.done, deleted: !!i.deleted, timestamp: num(i.timestamp),
                 created: num(i.created) || num(i.timestamp) };
      if (typeof i.by === 'string') it.by = i.by.slice(0, 20);
      items.push(it);
    });
    var m = st.meta && typeof st.meta === 'object' ? st.meta : {};
    var out = { items: items, meta: { title: typeof m.title === 'string' && m.title.trim() ? m.title.slice(0, 120) : 'LISTA',
                                      timestamp: num(m.timestamp) }, ovr: {} };
    var known = ListoAisles.AISLES.map(function (a) { return a.id; });
    if (st.ovr && typeof st.ovr === 'object') Object.keys(st.ovr).slice(0, 3000).forEach(function (k) {
      var v = st.ovr[k];
      if (KEY_RE.test(k) && v && known.indexOf(v.aisle) >= 0) out.ovr[k] = { aisle: v.aisle, ts: num(v.ts) };
    });
    if (st.order && Array.isArray(st.order.ids)) {
      out.order = { ids: st.order.ids.filter(function (x) { return known.indexOf(x) >= 0; }), ts: num(st.order.ts) };
    }
    return out;
  }
  // Forget deletions older than TOMBSTONE_DAYS (a phone offline longer than that could bring one back).
  function purgeOld(st) {
    var cutoff = now() - TOMBSTONE_DAYS * 24 * 3600 * 1000;
    st.items = st.items.filter(function (i) { return !i.deleted || (i.timestamp || 0) > cutoff; });
    return st;
  }
  // What travels to the relay: deleted items shrink to {id, deleted, timestamp}.
  function wire(st) {
    var out = Object.assign({}, st);
    out.items = purgeOld({ items: st.items.slice() }).items.map(function (i) {
      return i.deleted ? { id: i.id, deleted: true, timestamp: i.timestamp || 0 } : i;
    });
    return out;
  }
  function hints() { return store.get(K.hints, {}); }
  function setHint(k) { var h = hints(); h[k] = true; store.set(K.hints, h); }

  // ---------- one-time migration from the first version (index.html before 2026-09-25) ----------
  function migrateV1() {
    if (store.get('ll2_migrated')) return;
    var lists = store.get(K.index, {}), map = {};
    [store.get('listolista_index_local', {}), store.get('listolista_index_shared', {})].forEach(function (idx, shared) {
      Object.keys(idx || {}).forEach(function (oldId) {
        var old = store.get('listolista_data_' + oldId);
        if (!old || !Array.isArray(old.items)) return;
        var id = 'l_' + rid(8);
        var st = emptyState((old.meta && old.meta.title) || 'LISTA');
        st.meta.timestamp = (old.meta && old.meta.timestamp) || 0;
        st.items = old.items.map(function (i) {
          var t = i.timestamp || i.ts || 0;
          return { id: String(i.id), text: String(i.text || ''), done: !!i.done, deleted: !!i.deleted, timestamp: t, created: i.ts || t };
        });
        store.set(K.list(id), st);
        lists[id] = { title: st.meta.title, lastVisited: (idx[oldId] && idx[oldId].lastVisited) || 0, wasShared: !!shared };
        map[oldId] = id;
      });
    });
    var lastOld = null; try { lastOld = localStorage.getItem('last_local_id'); } catch (e) {}
    var newest = Object.keys(lists).sort(function (a, b) { return (lists[b].lastVisited || 0) - (lists[a].lastVisited || 0); })[0];
    if (!store.get(K.last) && (map[lastOld] || newest)) store.set(K.last, map[lastOld] || newest);
    store.set(K.index, lists); store.set(K.v1map, map); store.set('ll2_migrated', true);
  }

  // ---------- the open list ----------
  var cur = { id: null, secret: null, keys: null, relay: null, state: null, status: 'local' };
  var view = { aisles: false, doneOpen: true };
  var flashIds = {};

  function listIndex() { return store.get(K.index, {}); }
  function touchIndex(id, patch) {
    var idx = listIndex();
    idx[id] = Object.assign({}, idx[id] || {}, patch || {}, { lastVisited: now() });
    store.set(K.index, idx);
  }
  function persist() {
    var stored = sanitize(store.get(K.list(cur.id)));
    if (stored) cur.state = ListoMerge.merge(cur.state, stored).state;   // another open copy may have saved
    purgeOld(cur.state);
    store.set(K.list(cur.id), cur.state);
    var e = listIndex()[cur.id];
    var blank = !cur.state.items.length && !cur.state.meta.timestamp && !cur.secret;
    if (e || !blank) touchIndex(cur.id, { title: cur.state.meta.title, secret: cur.secret || undefined });
  }
  function changed(ids) {
    persist();
    if (cur.relay) cur.relay.put(wire(cur.state));
    render(ids);
  }

  function closeCurrent() {
    if (cur.relay) { cur.relay.close(); cur.relay = null; }
    clearTimeout(snackTimer); snackUndo = null; $('snack').classList.remove('show');   // undo belongs to the old list
    cur = { id: null, secret: null, keys: null, relay: null, state: null, status: 'local' };
  }

  function openLocal(id) {
    closeCurrent();
    cur.id = id;
    cur.state = sanitize(store.get(K.list(id))) || emptyState();
    var e = listIndex()[id] || {};
    view.aisles = !!e.aisles;
    store.set(K.last, id);
    history.replaceState(null, '', location.pathname + '#l=' + id);
    persist(); setStatus('local'); render(); focusInput();
    if (e.wasShared && !hints()['ws_' + id]) {
      showHint('Esta lista antes se compartía. Ahora las listas compartidas son privadas y cifradas: toca Compartir y manda el nuevo enlace a quien la usaba.', 'ws_' + id);
    }
  }

  function openShared(secret) {
    closeCurrent();
    return ListoSync.derive(secret).then(function (keys) {
      cur.id = keys.roomId; cur.secret = secret; cur.keys = keys;
      cur.state = sanitize(store.get(K.list(cur.id))) || emptyState();
      view.aisles = !!(listIndex()[cur.id] || {}).aisles;
      store.set(K.last, cur.id);
      history.replaceState(null, '', location.pathname + '#k=' + secret);
      connect();
      persist();
      try { render(); } catch (e) { cur.state = emptyState(); render(); }
      focusInput();
      if (isIOS() && !isStandalone()) setTimeout(function () { showInstallHint(false); }, 1500);
    }, function () { toast('Ese enlace no es válido.'); openLocal('l_' + rid(8)); });
  }

  function connect() {
    if (!RELAY) { setStatus('offline'); return; }
    setStatus('connecting');
    cur.relay = new ListoSync.Relay(RELAY, cur.keys, {
      onRemote: onRemote,
      onStatus: setStatus,
      onError: function (code) {
        if (code === 'too_big') toast('La lista es demasiado grande para compartirla.');
        else if (code === 'forbidden') toast('Este enlace ya no puede modificar la lista.');
      },
    });
  }

  function onRemote(remote) {
    if (remote) { remote = sanitize(remote); if (!remote) return; }
    var before = Object.create(null);
    cur.state.items.forEach(function (i) { before[i.id] = i.timestamp || 0; });
    var m = ListoMerge.merge(cur.state, remote);
    cur.state = m.state;
    if (!cur.state.ovr) cur.state.ovr = {};
    if (m.changed) {
      var ids = cur.state.items.filter(function (i) { return !(i.id in before) || (i.timestamp || 0) > before[i.id]; })
        .map(function (i) { return i.id; });
      store.set(K.list(cur.id), cur.state);
      touchIndex(cur.id, { title: cur.state.meta.title, secret: cur.secret });
      render(ids);
    }
    if (m.localNewer && cur.relay) cur.relay.put(wire(cur.state));
  }

  function setStatus(s) {
    cur.status = s;
    var dot = $('dot');
    dot.className = 'dot' + (s === 'online' ? ' on' : (s === 'local' ? '' : ' wait'));
    clearTimeout(setStatus.t);
    if (s === 'offline' || s === 'connecting') setStatus.t = setTimeout(function () {
      if (cur.status !== 'online' && cur.secret) $('offline').classList.add('show');
    }, 4000);
    else $('offline').classList.remove('show');
    setTimeout(layout, 0); setTimeout(layout, 4100);
  }

  // ---------- items ----------
  // "huevos, leche y pan" -> three items; "pan y mantequilla" stays one (no comma, no split).
  function splitItems(text) {
    var parts = text.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length > 1) {
      var last = parts.pop().split(/\s+y\s+/i).map(function (s) { return s.trim(); }).filter(Boolean);
      parts = parts.concat(last);
    }
    return parts;
  }
  function addFrom(input) {
    var text = input.value.trim();
    if (!text) return;
    var t = now(), ids = [];
    splitItems(text).forEach(function (s, k) {
      var it = { id: rid(8), text: s, done: false, deleted: false, timestamp: t + k, created: t + k, by: DEVICE };
      cur.state.items.push(it); ids.push(it.id);
    });
    input.value = '';
    changed(ids);
    input.focus();
    var last = document.querySelector('[data-id="' + ids[ids.length - 1] + '"]');
    if (last && last.getBoundingClientRect().top > (window.visualViewport ? visualViewport.height : innerHeight) - 40) {
      toast(ids.length > 1 ? 'Añadidos ' + ids.length + ' artículos (abajo)' : 'Añadido: ' + text + ' (abajo)');
    }
  }
  function find(id) { return cur.state.items.find(function (i) { return i.id === id; }); }
  function toggle(id) {
    var it = find(id); if (!it) return;
    it.done = !it.done; it.timestamp = bump(it.timestamp);
    changed([id]);
  }
  function remove(id) {
    var it = find(id); if (!it) return;
    it.deleted = true; it.timestamp = bump(it.timestamp);
    changed([]);
    undo('Borrado: ' + it.text, function () { it.deleted = false; it.timestamp = bump(it.timestamp); changed([id]); });
  }
  function editText(id, text) {
    var it = find(id); if (!it || !text.trim() || text.trim() === it.text) return;
    it.text = text.trim(); it.timestamp = bump(it.timestamp);
    changed([id]);
  }
  function clearDone() {
    var gone = cur.state.items.filter(function (i) { return i.done && !i.deleted; });
    if (!gone.length) return;
    gone.forEach(function (i) { i.deleted = true; i.timestamp = bump(i.timestamp); });
    changed([]);
    undo(gone.length + (gone.length === 1 ? ' tachado borrado' : ' tachados borrados'), function () {
      gone.forEach(function (i) { i.deleted = false; i.timestamp = bump(i.timestamp); }); changed([]);
    });
  }
  function emptyList() {
    var gone = cur.state.items.filter(function (i) { return !i.deleted; });
    if (!gone.length) return;
    gone.forEach(function (i) { i.deleted = true; i.timestamp = bump(i.timestamp); });
    changed([]);
    undo('Lista vaciada', function () { gone.forEach(function (i) { i.deleted = false; i.timestamp = bump(i.timestamp); }); changed([]); });
  }

  // ---------- aisles (loaded on first use: pay for what you use) ----------
  var aisleIndex = null;
  function aisles() {
    if (!aisleIndex) {
      var dict = {};
      String(LISTO_DICT_TEXT || '').split('\n').forEach(function (line) {
        line = line.trim(); if (!line || line[0] === '#') return;
        var c = line.indexOf(':');
        dict[line.slice(0, c).trim()] = line.slice(c + 1).split('|').map(function (s) { return s.trim(); }).filter(Boolean);
      });
      aisleIndex = ListoAisles.buildIndex(dict);
    }
    return aisleIndex;
  }
  function overrides() {
    var o = {}, src = cur.state.ovr || {};
    Object.keys(src).forEach(function (k) { if (src[k] && src[k].aisle) o[k] = src[k].aisle; });
    return o;
  }
  function aisleOrder() {
    var ids = (cur.state.order && cur.state.order.ids) || [];
    var all = ListoAisles.AISLES.map(function (a) { return a.id; });
    var out = ids.filter(function (id) { return all.indexOf(id) >= 0; });
    all.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  }
  function aisleName(id) {
    var a = ListoAisles.AISLES.find(function (x) { return x.id === id; });
    return a ? a.name : id;
  }
  function itemKey(text) { return ListoAisles.stripQuantity(ListoAisles.fold(text)); }
  function setAisle(it, aisleId) {
    cur.state.ovr = cur.state.ovr || {};
    var k = itemKey(it.text);
    cur.state.ovr[k] = { aisle: aisleId, ts: bump((cur.state.ovr[k] || {}).ts) };
    changed([it.id]);
  }
  function moveAisle(id, dir) {
    var order = aisleOrder(), i = order.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    order[i] = order[j]; order[j] = id;
    cur.state.order = { ids: order, ts: bump((cur.state.order || {}).ts) };
    changed([]);
  }

  // ---------- rendering ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render(ids) {
    (ids || []).forEach(function (id) { flashIds[id] = true; });
    var title = $('title');
    if (document.activeElement !== title) title.textContent = cur.state.meta.title || 'LISTA';
    document.title = (cur.state.meta.title || 'LISTA') + ' · ListoLista';

    var live = cur.state.items.filter(function (i) { return !i.deleted; });
    var pending = live.filter(function (i) { return !i.done; })
      .sort(function (a, b) { return (a.created || a.timestamp || 0) - (b.created || b.timestamp || 0); });
    var done = live.filter(function (i) { return i.done; }).sort(function (a, b) { return b.timestamp - a.timestamp; });

    var pBox = $('pending'); pBox.textContent = '';
    if (view.aisles) {
      var idx = aisles(), ov = overrides(), groups = Object.create(null);
      pending.forEach(function (it) {
        var r = ListoAisles.aisleOf(it.text, idx, ov);
        (groups[r.id] = groups[r.id] || []).push({ it: it, r: r });
      });
      aisleOrder().forEach(function (aid) {
        if (!groups[aid]) return;
        pBox.appendChild(el('div', 'group', aisleName(aid)));
        groups[aid].forEach(function (g) { pBox.appendChild(row(g.it, g.r)); });
      });
    } else {
      pending.forEach(function (it) { pBox.appendChild(row(it, null)); });
    }

    var dBox = $('donebox'); dBox.textContent = '';
    if (done.length) {
      var head = el('div', 'done-head');
      var tog = el('button', '', (view.doneOpen ? '▾ ' : '▸ ') + 'Tachados (' + done.length + ')');
      tog.onclick = function () { view.doneOpen = !view.doneOpen; render(); };
      var clr = el('button', '', 'Limpiar');
      clr.onclick = clearDone;
      head.append(tog, clr); dBox.appendChild(head);
      if (view.doneOpen) done.forEach(function (it) { dBox.appendChild(row(it, null)); });
    }
    flashIds = {};
  }

  function row(it, aisle) {
    var r = el('div', 'row' + (it.done ? ' done' : '') + (flashIds[it.id] ? ' flash' : ''));
    r.dataset.id = it.id;
    var txt = el('span', 'txt', it.text);
    txt.setAttribute('role', 'checkbox'); txt.setAttribute('aria-checked', it.done ? 'true' : 'false'); txt.tabIndex = 0;
    r.appendChild(txt);
    if (aisle) {
      var tag = el('button', 'tag' + (aisle.guess ? ' guess' : ''), aisleName(aisle.id) + (aisle.guess ? '?' : ''));
      tag.setAttribute('aria-label', 'Cambiar pasillo de ' + it.text + ' (ahora: ' + aisleName(aisle.id) + ')');
      tag.onclick = function (e) { e.stopPropagation(); aislePicker(it, aisle.id); };
      tag.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      r.appendChild(tag);
    }
    // tap = strike / unstrike; long-press = edit / delete (one sheet per press, even on Android)
    var timer = null, long = false;
    var openSheet = function () { if (long) return; long = true; clearTimeout(timer); itemSheet(it); };
    r.addEventListener('pointerdown', function () { long = false; clearTimeout(timer); timer = setTimeout(openSheet, 550); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { r.addEventListener(ev, function () { clearTimeout(timer); }); });
    r.addEventListener('contextmenu', function (e) { e.preventDefault(); openSheet(); });
    r.addEventListener('click', function (e) {
      if (e.target.closest('.tag')) return;
      if (long) { long = false; return; }
      toggle(it.id); maybeLongPressHint();
    });
    txt.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(it.id); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(it.id); }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); itemSheet(it); }
    });
    return r;
  }

  // ---------- sheets (menu, lists, item actions, aisle picker, aisle order) ----------
  var closeOpenSheet = null;
  window.addEventListener('popstate', function () { if (closeOpenSheet) closeOpenSheet(true); });
  function sheet(build) {
    if (closeOpenSheet) closeOpenSheet();
    var bg = el('div', 'sheet-bg'), s = el('div', 'sheet');
    s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    bg.appendChild(s);
    var closed = false;
    var close = function (fromBack) {
      if (closed) return; closed = true; closeOpenSheet = null;
      bg.remove(); document.removeEventListener('keydown', esc);
      // leave the extra history entry harmless (Back then stays on this list)
      if (!fromBack && history.state && history.state.sheet) history.replaceState(null, '', location.href);
    };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', esc);
    var x = el('button', 'sheet-close', 'Cerrar');
    x.onclick = function () { close(); };
    s.appendChild(x);
    build(s, close);
    history.pushState({ sheet: true }, '', location.href);   // Back closes the sheet instead of leaving
    closeOpenSheet = close;
    document.body.appendChild(bg);
    var first = s.querySelector('input') || s.querySelector('.opt, .aisle-grid button, .order-row button');
    if (first) first.focus();
    return close;
  }
  function opt(label, onClick, extra) {
    var b = el('button', 'opt' + (extra && extra.warn ? ' warn' : ''));
    b.appendChild(el('span', '', label));
    if (extra && extra.small) b.appendChild(el('small', '', extra.small));
    if (extra && extra.sw != null) {
      b.appendChild(el('span', 'switch' + (extra.sw ? ' on' : '')));
      b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', extra.sw ? 'true' : 'false');
    }
    b.onclick = onClick;
    return b;
  }

  function menu() {
    sheet(function (s, close) {
      s.appendChild(opt('Ordenar por pasillo', function () {
        view.aisles = !view.aisles; touchIndex(cur.id, { aisles: view.aisles }); close(); render();
      }, { sw: view.aisles }));
      s.appendChild(opt('Orden de los pasillos', function () { close(); orderSheet(); }, { small: 'como tu súper' }));
      s.appendChild(opt('Borrar tachados', function () { close(); clearDone(); }));
      s.appendChild(opt('Mis listas', function () { close(); listsSheet(); }));
      s.appendChild(opt('Nueva lista', function () { close(); openLocal('l_' + rid(8)); }));
      if (installPrompt) s.appendChild(opt('Instalar como app', function () { close(); installPrompt.prompt(); installPrompt = null; }));
      else if (isIOS() && !isStandalone()) s.appendChild(opt('Usar como app', function () {
        close();
        if (cur.secret) showInstallHint(true);
        else showHint('En iPhone, primero toca Compartir: el ícono de inicio debe crearse desde el enlace de la lista para que la abra.', null);
      }));
      s.appendChild(opt('Vaciar la lista', function () { close(); emptyList(); }, { warn: true }));
    });
  }

  function listsSheet() {
    sheet(function (s, close) {
      s.appendChild(el('h2', '', 'Mis listas'));
      var idx = listIndex();
      Object.keys(idx).sort(function (a, b) { return (idx[b].lastVisited || 0) - (idx[a].lastVisited || 0); }).forEach(function (id) {
        var e = idx[id];
        var b = opt((id === cur.id ? '• ' : '') + (e.title || 'LISTA'), function () {
          close(); if (e.secret) openShared(e.secret); else openLocal(id);
        }, { small: e.secret ? 'compartida' : (e.wasShared ? 'antes compartida' : 'solo aquí') });
        s.appendChild(b);
      });
      s.appendChild(opt('+ Nueva lista', function () { close(); openLocal('l_' + rid(8)); }));
      s.appendChild(el('h2', '', 'Abrir un enlace compartido'));
      var p = el('div', 'paste'), inp = el('input'), go = el('button', '', 'Abrir');
      inp.placeholder = 'Pega aquí el enlace'; inp.setAttribute('aria-label', 'Enlace compartido');
      go.onclick = function () {
        var m = /#k=([A-Za-z0-9_-]{22})/.exec(inp.value) || /^([A-Za-z0-9_-]{22})$/.exec(inp.value.trim());
        if (!m) { toast('No encuentro una lista en ese enlace.'); return; }
        close(); openShared(m[1]);
      };
      p.append(inp, go); s.appendChild(p);
    });
  }

  function itemSheet(it) {
    sheet(function (s, close) {
      s.appendChild(el('h2', '', it.text));
      var box = el('div', 'edit-box'), inp = el('input');
      inp.value = it.text; inp.setAttribute('aria-label', 'Editar artículo');
      inp.onkeydown = function (e) { if (e.key === 'Enter') { editText(it.id, inp.value); close(); } };
      box.appendChild(inp); s.appendChild(box);
      s.appendChild(opt('Guardar cambio', function () { editText(it.id, inp.value); close(); }));
      s.appendChild(opt('Cambiar pasillo', function () {
        close(); aislePicker(it, ListoAisles.aisleOf(it.text, aisles(), overrides()).id);
      }));
      s.appendChild(opt('Borrar', function () { close(); remove(it.id); }, { warn: true }));
    });
  }

  function aislePicker(it, currentId) {
    sheet(function (s, close) {
      s.appendChild(el('h2', '', '¿En qué pasillo está «' + it.text + '»?'));
      var grid = el('div', 'aisle-grid');
      aisleOrder().forEach(function (id) {
        var b = el('button', id === currentId ? 'cur' : '', aisleName(id));
        b.onclick = function () { close(); setAisle(it, id); toast('Recordado para esta lista.'); };
        grid.appendChild(b);
      });
      s.appendChild(grid);
    });
  }

  function orderSheet() {
    sheet(function (s) {
      s.appendChild(el('h2', '', 'Orden de los pasillos (como recorres tu súper)'));
      var list = el('div');
      var draw = function () {
        list.textContent = '';
        aisleOrder().forEach(function (id, i, all) {
          var r = el('div', 'order-row');
          r.appendChild(el('span', '', aisleName(id)));
          var up = el('button', '', '↑'), dn = el('button', '', '↓');
          up.setAttribute('aria-label', 'Subir ' + aisleName(id)); dn.setAttribute('aria-label', 'Bajar ' + aisleName(id));
          up.disabled = i === 0; dn.disabled = i === all.length - 1;
          up.onclick = function () { moveAisle(id, -1); draw(); };
          dn.onclick = function () { moveAisle(id, 1); draw(); };
          r.append(up, dn); list.appendChild(r);
        });
      };
      draw(); s.appendChild(list);
    });
  }

  // ---------- sharing ----------
  function share() {
    if (cur.secret) return offerLink();
    // Turn this list into a shared one: new secret, same items, now end-to-end encrypted.
    var secret = ListoSync.newSecret(), st = cur.state, oldId = cur.id;
    ListoSync.derive(secret).then(function (keys) {
      store.set(K.list(keys.roomId), st);
      var idx = listIndex(); delete idx[oldId]; store.set(K.index, idx); store.del(K.list(oldId));   // moved, not copied
      return openShared(secret);
    }).then(offerLink);
  }
  function offerLink() {
    var url = location.origin + location.pathname + '#k=' + cur.secret;
    var title = cur.state.meta.title || 'Lista';
    if (navigator.share) {
      navigator.share({ title: title, text: 'Nuestra lista: ' + title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Enlace copiado. Quien lo tenga puede ver y editar la lista.'); },
        function () { prompt('Copia este enlace:', url); });
    } else { prompt('Copia este enlace:', url); }
    if (isIOS() && !isStandalone()) setTimeout(function () { showInstallHint(false); }, 1500);
  }

  // ---------- small UI pieces ----------
  var snackTimer = null, snackUndo = null;
  function undo(text, fn) {
    $('snack-text').textContent = text;
    snackUndo = fn;
    $('snack-undo').style.display = '';
    $('snack').classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { $('snack').classList.remove('show'); snackUndo = null; }, 8000);
  }
  function toast(text) {
    $('snack-text').textContent = text;
    snackUndo = null; $('snack-undo').style.display = 'none';
    $('snack').classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { $('snack').classList.remove('show'); }, 3500);
  }
  function maybeLongPressHint() {
    if (hints().longpress) return;
    setHint('longpress');
    setTimeout(function () { toast('Consejo: mantén presionado un artículo para editarlo o borrarlo.'); }, 600);
  }
  var isIOS = function () { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); };
  var isStandalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  function showHint(text, key) {
    var h = $('hint');
    h.textContent = '';
    h.appendChild(el('div', '', text));
    var ok = el('button', '', 'Entendido');
    ok.onclick = function () { if (key) setHint(key); h.classList.remove('show'); };
    h.appendChild(ok); h.classList.add('show');
  }
  function showInstallHint(force) {
    if (!force && hints().install) return;
    showHint('Para tenerla como app en tu iPhone: en Safari toca Compartir (el cuadro con la flecha; si no lo ves, toca ⋯ junto a la dirección) y elige «Agregar a inicio». Hazlo con esta lista abierta para que el ícono la abra.', 'install');
  }
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installPrompt = e; });

  function focusInput() { var i = $('i1'); try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }
  function layout() {
    var h = document.querySelector('header').getBoundingClientRect().height;
    $('main').style.top = h + 'px';
  }

  // ---------- wiring ----------
  function bind() {
    ['i1', 'i2'].forEach(function (id) {
      var inp = $(id);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addFrom(inp); } });
    });
    var title = $('title'), titleTimer = null;
    title.addEventListener('input', function () {
      cur.state.meta = Object.assign({}, cur.state.meta, { title: (title.textContent.trim() || 'LISTA').slice(0, 120), timestamp: bump(cur.state.meta.timestamp) });
      clearTimeout(titleTimer);
      titleTimer = setTimeout(function () { changed([]); }, 400);
    });
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); title.blur(); focusInput(); } });
    $('btn-share').onclick = share;
    $('btn-menu').onclick = menu;
    $('btn-lists').onclick = listsSheet;
    $('snack-undo').onclick = function () { var f = snackUndo; snackUndo = null; $('snack').classList.remove('show'); if (f) f(); };
    // The empty area below the list is one big "tap to write" target (iPhone needs one tap for the keyboard).
    $('write-zone').addEventListener('click', focusInput);
    $('main').addEventListener('click', function (e) { if (e.target === $('main')) focusInput(); });
    window.addEventListener('hashchange', function () { start(); });
    // After the phone sleeps, always open a fresh connection (sockets die silently in the background).
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (cur.relay) cur.relay.reconnectNow();
      else if (cur.id) { var st = sanitize(store.get(K.list(cur.id))); if (st) { cur.state = ListoMerge.merge(cur.state, st).state; render(); } }
    });
    window.addEventListener('online', function () { if (cur.relay) cur.relay.reconnectNow(); });
    // Another open copy of the app (tab or installed app) saved this list: merge it in.
    window.addEventListener('storage', function (e) {
      if (!cur.id || e.key !== K.list(cur.id) || !e.newValue) return;
      var st; try { st = sanitize(JSON.parse(e.newValue)); } catch (err) { return; }
      if (!st) return;
      var m = ListoMerge.merge(cur.state, st);
      cur.state = m.state;
      if (m.changed) render();
    });
    window.addEventListener('pagehide', function () { if (cur.id) persist(); });
    window.addEventListener('resize', layout);
  }

  function start() {
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var q = new URLSearchParams(location.search);
    var k = h.get('k'), l = h.get('l');
    if (k && k === cur.secret) return;
    if (l && l === cur.id) return;
    if (k) return openShared(k);
    var old = q.get('room') || q.get('local'), v1 = store.get(K.v1map, {});
    if (old && v1[old]) { history.replaceState(null, '', location.pathname); return openLocal(v1[old]); }
    if (old) { history.replaceState(null, '', location.pathname); setTimeout(function () { toast('Esa lista no está en este teléfono. Pide un enlace nuevo.'); }, 300); }
    if (l && store.get(K.list(l))) return openLocal(l);
    var last = store.get(K.last), e = last && listIndex()[last];
    if (e) return e.secret ? openShared(e.secret) : openLocal(last);
    openLocal('l_' + rid(8));
  }

  migrateV1();
  bind();
  layout();
  start();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
