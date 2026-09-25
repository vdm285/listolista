// ListoLista aisle matcher: which supermarket aisle does a free-text item belong to?
// Plain script (no modules, no libraries): defines the global `ListoAisles`.
// Runs in browsers and in macOS `jsc` (tests: tests/run.sh).
//
// SPEC (docs/research/2026-09-25-aisle-sorting.md, "Recommendation for checkpoint 1")
//
// ListoAisles.fold(text) -> string
//   Lowercase; remove accents and marks (NFD, then drop \p{M}, so ñ -> n, é -> e); a "." or ","
//   between two digits becomes "." (decimals: "1,5" -> "1.5"); every other character that is not
//   a letter, digit or "/" becomes a space; collapse spaces; trim.
//
// ListoAisles.stripQuantity(folded) -> string
//   Removes a quantity at the START or END of an already folded text, e.g.
//     "2 kg de tortillas" -> "tortillas", "1/2 docena de huevos" -> "huevos",
//     "medio kilo de jamon de pavo" -> "jamon de pavo", "coca cola 3 litros" -> "coca cola",
//     "3 leches" -> "leches", "panales etapa 3" -> "panales etapa".
//   A quantity is: a number (digits, "1/2", "1.5") optionally followed by a unit and/or "de";
//   or a number WORD (un, una, medio, media, dos ... diez) only when followed by a unit.
//   Units: kg, kilo, kilos, g, gr, gramos, l, lt, litro, litros, ml, pieza, piezas, pz,
//   paquete, paquetes, docena, docenas, lata, latas, bolsa, bolsas, caja, cajas.
//   Number words NOT followed by a unit stay: "tres leches" stays "tres leches".
//
// ListoAisles.buildIndex(dict) -> index
//   dict = { AISLE_ID: [term, term, ...], ... }. Terms may contain accents or several words;
//   fold them the same way as items. The index is whatever aisleOf needs (precompute here, not
//   on every call).
//
// ListoAisles.aisleOf(text, index, overrides) -> { id, term, guess }
//   id: an aisle id from the dict, or "OTR" when nothing matches. term: the matched dictionary
//   term (folded) or null. guess: true only for a typo-fallback match.
//   Steps, in order:
//   1. key = stripQuantity(fold(text)). Empty key -> { id: "OTR", term: null, guess: false }.
//   2. overrides (optional object { folded item name: AISLE_ID }): if overrides[key] exists,
//      return it (term = key, guess = false).
//   3. Whole-word phrase scan over the words of key. A dictionary term of n words matches at
//      position i when each of its words equals the item word at i+j OR one of that word's
//      singular candidates: w, w minus final "s", w minus final "es", and "ces" -> "z"
//      (nueces -> nuez). Never match inside a word ("pan" must not match "pantuflas").
//      Prefer the term with the MOST words; among equal word counts, the LEFTMOST match.
//      Filler words alone never match: de, del, la, el, los, las, para, con, sin, y, en, al, marca.
//   4. Typo fallback, only when step 3 found nothing: for each item word with 5+ letters, find
//      single-word terms at Damerau-Levenshtein distance 1 (distance up to 2 when the word has
//      8+ letters). Take the smallest distance found; accept only if ALL terms at that distance
//      belong to the SAME aisle; return that with guess = true.
//   5. Otherwise { id: "OTR", term: null, guess: false }.
//
// ListoAisles.AISLES: [{ id, name }] in the default walking order:
//   FRU Frutas y verduras, PAN Panadería y tortillería, CAR Carnes y salchichonería,
//   LAC Lácteos y huevo, CON Congelados, DES Despensa, BOT Botanas y dulces,
//   BEB Bebidas y licores, LIM Limpieza y hogar, HIG Higiene personal, FAR Farmacia,
//   BBE Bebés, MAS Mascotas, OTR Otros.

var ListoAisles = (function () {
  'use strict';

  /* ---------- constants ---------- */
  var FILLERS = { de: 1, del: 1, la: 1, el: 1, los: 1, las: 1,
                  para: 1, con: 1, sin: 1, y: 1, en: 1, al: 1, marca: 1 };

  var UNITS = { kg: 1, kilo: 1, kilos: 1, g: 1, gr: 1, gramos: 1,
                l: 1, lt: 1, litro: 1, litros: 1, ml: 1,
                pieza: 1, piezas: 1, pz: 1,
                paquete: 1, paquetes: 1, docena: 1, docenas: 1,
                lata: 1, latas: 1, bolsa: 1, bolsas: 1, caja: 1, cajas: 1 };

  var NUM_WORDS = { un: 1, una: 1, uno: 1, medio: 1, media: 1,
                    dos: 1, tres: 1, cuatro: 1, cinco: 1,
                    seis: 1, siete: 1, ocho: 1, nueve: 1, diez: 1 };

  /* ---------- fold ---------- */
  function fold(text) {
    // 1. lowercase
    text = text.toLowerCase();
    // 2. NFD + strip combining marks; also ñ -> n
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n');
    // 3+4. decimal comma/dot between digits stays, everything else non-alnum/slash -> space
    //       single pass so the dot from step 3 is not eaten by step 4
    text = text.replace(/(\d)[.,](\d)|[^a-z0-9\/]/g, function (m, d1, d2) {
      return d1 !== undefined ? d1 + '.' + d2 : ' ';
    });
    // 5. collapse & trim
    return text.replace(/  +/g, ' ').trim();
  }

  /* ---------- stripQuantity ---------- */
  function stripQuantity(s) {
    var unitsRe = '(?:' + Object.keys(UNITS).join('|') + ')';
    var numWordRe = '(?:' + Object.keys(NUM_WORDS).join('|') + ')';
    var num = '(?:\\d+/\\d+|\\d+\\.\\d+|\\d+)';
    var qty = num + '(?:\\s+' + unitsRe + '\\b)?(?:\\s+de)?';
    var qtyWord = numWordRe + '(?:\\s+' + unitsRe + '\\b)(?:\\s+de)?';
    var startRe = new RegExp('^\\s*(?:(' + qty + '|' + qtyWord + ')\\s*)(.*)');
    var endRe = new RegExp('^(.*)\\s*(?:(' + qty + '|' + qtyWord + '))\\s*$');

    // try removing from the start
    var m = s.match(startRe);
    if (m && m[2] && m[2].trim()) return m[2].trim();

    // try removing from the end
    m = s.match(endRe);
    if (m && m[1] && m[1].trim()) return m[1].trim();

    return s;
  }

  /* ---------- singular candidates ---------- */
  function singulars(word) {
    var cands = [word];
    if (word.length > 1 && word[word.length - 1] === 's') {
      cands.push(word.slice(0, -1));
      if (word.length > 2 && word.slice(-2) === 'es') {
        cands.push(word.slice(0, -2));
      }
    }
    if (word.length > 3 && word.slice(-3) === 'ces') {
      cands.push(word.slice(0, -3) + 'z');
    }
    return cands;
  }

  /* ---------- Damerau-Levenshtein distance ---------- */
  function dl(a, b) {
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99;
    var d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; }
    for (var j = 0; j <= n; j++) { d[0][j] = j; }
    for (var i = 1; i <= m; i++) {
      for (var j = 1; j <= n; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
                           d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
        }
      }
    }
    return d[m][n];
  }

  /* ---------- buildIndex ---------- */
  function buildIndex(dict) {
    var index = { aisles: {}, singles: {} };
    for (var aid in dict) {
      index.aisles[aid] = [];
      for (var i = 0; i < dict[aid].length; i++) {
        var ft = fold(dict[aid][i]);
        index.aisles[aid].push(ft);
        var words = ft.split(' ');
        if (words.length === 1) {
          if (!index.singles[ft]) index.singles[ft] = [];
          index.singles[ft].push(aid);
        }
      }
    }
    return index;
  }

  /* ---------- aisleOf ---------- */
  function aisleOf(text, index, overrides) {
    var key = stripQuantity(fold(text));
    if (!key) return { id: 'OTR', term: null, guess: false };

    // step 2 – overrides
    if (overrides && overrides[key]) {
      return { id: overrides[key], term: key, guess: false };
    }

    var words = key.split(' ');

    // step 3 – whole-word phrase scan
    var best = null; // { aisle, term, wc, pos }
    var allAisleIds = Object.keys(index.aisles);
    for (var ai = 0; ai < allAisleIds.length; ai++) {
      var aid = allAisleIds[ai];
      var terms = index.aisles[aid];
      for (var ti = 0; ti < terms.length; ti++) {
        var tw = terms[ti].split(' ');
        var twc = tw.length;
        if (twc > words.length) continue;

        // skip filler-only terms
        var allFiller = true;
        for (var f = 0; f < twc; f++) { if (!FILLERS[tw[f]]) { allFiller = false; break; } }
        if (allFiller) continue;

        var bestPos = -1;
        var maxEnd = words.length - twc + 1;
        for (var pos = 0; pos < maxEnd; pos++) {
          var ok = true;
          for (var j = 0; j < twc; j++) {
            var cand = singulars(words[pos + j]);
            if (cand.indexOf(tw[j]) === -1) { ok = false; break; }
          }
          if (ok) {
            if (bestPos === -1) bestPos = pos;
            break; // leftmost position for this term
          }
        }
        if (bestPos !== -1) {
          if (!best || twc > best.wc || (twc === best.wc && bestPos < best.pos)) {
            best = { aisle: aid, term: terms[ti], wc: twc, pos: bestPos };
          }
        }
      }
    }
    if (best) {
      return { id: best.aisle, term: best.term, guess: false };
    }

    // step 4 – typo fallback
    var maxDist = 1;
    // for 8+ letter words allow distance 2
    var bestDist = 99;
    var bestAisle = null;
    var foundAny = false;

    for (var wi = 0; wi < words.length; wi++) {
      if (words[wi].length < 5) continue;
      var limit = words[wi].length >= 8 ? 2 : 1;
      for (var st in index.singles) {
        var dist = dl(words[wi], st);
        if (dist > limit) continue;
        if (dist > bestDist) continue;
        foundAny = true;
        if (dist < bestDist) {
          bestDist = dist;
          bestAisle = index.singles[st];
        } else if (dist === bestDist) {
          // merge aisles
          for (var k = 0; k < index.singles[st].length; k++) {
            var a = index.singles[st][k];
            var already = false;
            for (var l = 0; l < bestAisle.length; l++) {
              if (bestAisle[l] === a) { already = true; break; }
            }
            if (!already) bestAisle.push(a);
          }
        }
      }
    }

    if (foundAny && bestAisle && bestAisle.length === 1) {
      return { id: bestAisle[0], term: null, guess: true };
    }

    // step 5
    return { id: 'OTR', term: null, guess: false };
  }

  /* ---------- AISLES list ---------- */
  var AISLES = [
    { id: 'FRU', name: 'Frutas y verduras' },
    { id: 'PAN', name: 'Panadería y tortillería' },
    { id: 'CAR', name: 'Carnes y salchichonería' },
    { id: 'LAC', name: 'Lácteos y huevo' },
    { id: 'CON', name: 'Congelados' },
    { id: 'DES', name: 'Despensa' },
    { id: 'BOT', name: 'Botanas y dulces' },
    { id: 'BEB', name: 'Bebidas y licores' },
    { id: 'LIM', name: 'Limpieza y hogar' },
    { id: 'HIG', name: 'Higiene personal' },
    { id: 'FAR', name: 'Farmacia' },
    { id: 'BBE', name: 'Bebés' },
    { id: 'MAS', name: 'Mascotas' },
    { id: 'OTR', name: 'Otros' }
  ];

  return { fold: fold, stripQuantity: stripQuantity,
           buildIndex: buildIndex, aisleOf: aisleOf, AISLES: AISLES };
})();
