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
  // TODO: implement the spec above.
  return {};
})();
