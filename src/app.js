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
    store.set(K.list(cur.id), cur.state);
    touchIndex(cur.id, { title: cur.state.meta.title, secret: cur.secret || undefined });
  }
  function changed(ids) {
    persist();
    if (cur.relay) cur.relay.put(cur.state);
    render(ids);
  }

  function closeCurrent() {
    if (cur.relay) { cur.relay.close(); cur.relay = null; }
    cur = { id: null, secret: null, keys: null, relay: null, state: null, status: 'local' };
  }

  function openLocal(id) {
    closeCurrent();
    cur.id = id;
    cur.state = store.get(K.list(id)) || emptyState();
    view.aisles = !!(listIndex()[id] || {}).aisles;
    store.set(K.last, id);
    history.replaceState(null, '', location.pathname + '#l=' + id);
    persist(); setStatus('local'); render(); focusInput();
  }

  function openShared(secret) {
    closeCurrent();
    return ListoSync.derive(secret).then(function (keys) {
      cur.id = keys.roomId; cur.secret = secret; cur.keys = keys;
      cur.state = store.get(K.list(cur.id)) || emptyState();
      view.aisles = !!(listIndex()[cur.id] || {}).aisles;
      store.set(K.last, cur.id);
      history.replaceState(null, '', location.pathname + '#k=' + secret);
      persist(); render(); focusInput();
      connect();
    }).catch(function () { toast('Ese enlace no es válido.'); openLocal('l_' + rid(8)); });
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
    var before = {};
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
    if (m.localNewer && cur.relay) cur.relay.put(cur.state);
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
  }
  function find(id) { return cur.state.items.find(function (i) { return i.id === id; }); }
  function toggle(id) {
    var it = find(id); if (!it) return;
    it.done = !it.done; it.timestamp = now();
    changed([id]);
  }
  function remove(id) {
    var it = find(id); if (!it) return;
    it.deleted = true; it.timestamp = now();
    changed([]);
    undo('Borrado: ' + it.text, function () { it.deleted = false; it.timestamp = now(); changed([id]); });
  }
  function editText(id, text) {
    var it = find(id); if (!it || !text.trim() || text.trim() === it.text) return;
    it.text = text.trim(); it.timestamp = now();
    changed([id]);
  }
  function clearDone() {
    var gone = cur.state.items.filter(function (i) { return i.done && !i.deleted; });
    if (!gone.length) return;
    var t = now();
    gone.forEach(function (i) { i.deleted = true; i.timestamp = t; });
    changed([]);
    undo(gone.length + (gone.length === 1 ? ' tachado borrado' : ' tachados borrados'), function () {
      var t2 = now(); gone.forEach(function (i) { i.deleted = false; i.timestamp = t2; }); changed([]);
    });
  }
  function emptyList() {
    var gone = cur.state.items.filter(function (i) { return !i.deleted; });
    if (!gone.length) return;
    var t = now();
    gone.forEach(function (i) { i.deleted = true; i.timestamp = t; });
    changed([]);
    undo('Lista vaciada', function () { var t2 = now(); gone.forEach(function (i) { i.deleted = false; i.timestamp = t2; }); changed([]); });
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
    cur.state.ovr[itemKey(it.text)] = { aisle: aisleId, ts: now() };
    changed([it.id]);
  }
  function moveAisle(id, dir) {
    var order = aisleOrder(), i = order.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    order[i] = order[j]; order[j] = id;
    cur.state.order = { ids: order, ts: now() };
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
      var idx = aisles(), ov = overrides(), groups = {};
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
    r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', it.done ? 'true' : 'false'); r.tabIndex = 0;
    r.appendChild(el('span', 'txt', it.text));
    if (aisle) {
      var tag = el('button', 'tag' + (aisle.guess ? ' guess' : ''), aisleName(aisle.id) + (aisle.guess ? '?' : ''));
      tag.setAttribute('aria-label', 'Cambiar pasillo de ' + it.text);
      tag.onclick = function (e) { e.stopPropagation(); aislePicker(it, aisle.id); };
      r.appendChild(tag);
    }
    // tap = strike / unstrike; long-press = edit / delete
    var timer = null, long = false;
    r.addEventListener('pointerdown', function () { long = false; timer = setTimeout(function () { long = true; itemSheet(it); }, 550); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { r.addEventListener(ev, function () { clearTimeout(timer); }); });
    r.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!long) { long = true; itemSheet(it); } });
    r.addEventListener('click', function () { if (long) { long = false; return; } toggle(it.id); maybeLongPressHint(); });
    r.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(it.id); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(it.id); }
    });
    return r;
  }

  // ---------- sheets (menu, lists, item actions, aisle picker, aisle order) ----------
  function sheet(build) {
    var bg = el('div', 'sheet-bg'), s = el('div', 'sheet');
    s.setAttribute('role', 'dialog');
    bg.appendChild(s);
    var close = function () { bg.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', esc);
    build(s, close);
    document.body.appendChild(bg);
    var first = s.querySelector('input, button'); if (first && first.tagName === 'INPUT') first.focus();
    return close;
  }
  function opt(label, onClick, extra) {
    var b = el('button', 'opt' + (extra && extra.warn ? ' warn' : ''));
    b.appendChild(el('span', '', label));
    if (extra && extra.small) b.appendChild(el('small', '', extra.small));
    if (extra && extra.sw != null) b.appendChild(el('span', 'switch' + (extra.sw ? ' on' : '')));
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
      else if (isIOS() && !isStandalone()) s.appendChild(opt('Usar como app', function () { close(); showInstallHint(true); }));
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
  function showInstallHint(force) {
    if (!force && hints().install) return;
    var h = $('hint');
    h.textContent = '';
    h.appendChild(el('div', '', 'Para tenerla como app en tu iPhone: toca Compartir (el cuadro con la flecha) y luego «Agregar a inicio». Hazlo desde esta lista para que el ícono la abra.'));
    var ok = el('button', '', 'Entendido');
    ok.onclick = function () { setHint('install'); h.classList.remove('show'); };
    h.appendChild(ok); h.classList.add('show');
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
      inp.addEventListener('blur', function () { if (inp.value.trim()) addFrom(inp); });
    });
    var title = $('title'), titleTimer = null;
    title.addEventListener('input', function () {
      cur.state.meta = Object.assign({}, cur.state.meta, { title: title.textContent.trim() || 'LISTA', timestamp: now() });
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
      if (document.visibilityState === 'visible' && cur.relay) cur.relay.reconnectNow();
    });
    window.addEventListener('pagehide', function () { if (cur.id) store.set(K.list(cur.id), cur.state); });
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
