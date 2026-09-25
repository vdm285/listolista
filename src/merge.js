// ListoLista merge: combine this phone's copy of a list with a copy from another phone.
// Plain script (no modules, no libraries): defines the global `ListoMerge`.
// Runs in browsers and in macOS `jsc` (tests: tests/run.sh).
//
// SPEC
// A list state looks like:
//   { items: [{ id, text, done, deleted, timestamp, ... }],
//     meta:  { title, timestamp },
//     ovr:   { "<folded item name>": { aisle: "<AISLE_ID>", ts: <number> }, ... },   // optional
//     order: { ids: ["FRU", "PAN", ...], ts: <number> } }                              // optional
// Deleted items stay in the list with deleted: true (so the deletion can travel to other phones).
// A missing timestamp/ts counts as 0. A missing items array counts as empty.
//
// ListoMerge.merge(local, remote) -> { state, changed, localNewer }
//   items: union by id. For an id present in both, the copy with the LARGER timestamp wins;
//          on a tie the local copy stays. Order: local items keep their order; items only in
//          remote are appended in remote order.
//   meta:  the one with the larger meta.timestamp wins; tie -> local. Missing meta -> the other.
//   ovr:   per key, the entry with the larger ts wins; tie -> local. Omit ovr from the result
//          when both sides lack it.
//   order: the whole object with the larger ts wins; tie -> local. Omit when both lack it.
//   Other top-level fields of local are kept as they are.
//   changed:    true when some remote entry (item, meta, ovr key, order) is missing from local or
//               has a strictly larger timestamp/ts (something came from remote).
//   localNewer: true when some local entry is missing from remote or has a strictly larger
//               timestamp/ts (so this phone should publish). Ties count as neither.
//   Never modify the input objects (return new objects/arrays; item objects may be shared).
//   Must accept remote = null/undefined (treat as an empty state).

var ListoMerge = (function () {
  'use strict';
  // TODO: implement the spec above.
  return {};
})();
