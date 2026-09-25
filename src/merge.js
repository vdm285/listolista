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

  function getTs(obj, field) {
    // Missing timestamp / ts counts as 0.
    return (obj && obj[field] != null) ? obj[field] : 0;
  }

  function merge(local, remote) {
    var changed = false;
    var localNewer = false;

    // Must accept remote = null/undefined (treat as empty state).
    if (!remote) { remote = {}; }

    var state = {};

    // --- items ---
    var localItems = local.items || [];
    var remoteItems = remote.items || [];

    // Build lookup indices (keys are item ids).
    var localIdx = {};
    for (var i = 0; i < localItems.length; i++) {
      localIdx[localItems[i].id] = i;
    }
    var remoteIdx = {};
    for (var j = 0; j < remoteItems.length; j++) {
      remoteIdx[remoteItems[j].id] = j;
    }

    // Merge: local items keep their order; remote-only appended in remote order.
    var mergedItems = [];
    for (var i = 0; i < localItems.length; i++) {
      var li = localItems[i];
      if (Object.prototype.hasOwnProperty.call(remoteIdx, li.id)) {
        var ri = remoteItems[remoteIdx[li.id]];
        var lTs = getTs(li, 'timestamp');
        var rTs = getTs(ri, 'timestamp');
        if (rTs > lTs) {
          mergedItems.push(ri);
          changed = true;
        } else {
          mergedItems.push(li);
          if (lTs > rTs) { localNewer = true; }
        }
      } else {
        // Item only in local.
        mergedItems.push(li);
        localNewer = true;
      }
    }
    for (var j = 0; j < remoteItems.length; j++) {
      var ri = remoteItems[j];
      if (!Object.prototype.hasOwnProperty.call(localIdx, ri.id)) {
        // Item only in remote.
        mergedItems.push(ri);
        changed = true;
      }
    }
    state.items = mergedItems;

    // --- meta ---
    var lMeta = local.meta;
    var rMeta = remote.meta;
    if (lMeta && rMeta) {
      var lTs = getTs(lMeta, 'timestamp');
      var rTs = getTs(rMeta, 'timestamp');
      if (rTs > lTs) {
        state.meta = { title: rMeta.title, timestamp: rTs };
        changed = true;
      } else if (lTs > rTs) {
        state.meta = { title: lMeta.title, timestamp: lTs };
        localNewer = true;
      } else {
        state.meta = { title: lMeta.title, timestamp: lTs };
      }
    } else if (rMeta) {
      state.meta = { title: rMeta.title, timestamp: getTs(rMeta, 'timestamp') };
      changed = true;
    } else if (lMeta) {
      state.meta = { title: lMeta.title, timestamp: getTs(lMeta, 'timestamp') };
    }

    // --- ovr (aisle corrections) ---
    var lOvr = local.ovr;
    var rOvr = remote.ovr;
    if (lOvr || rOvr) {
      var mergedOvr = {};
      if (lOvr) {
        for (var k in lOvr) {
          if (Object.prototype.hasOwnProperty.call(lOvr, k)) {
            // Key only in local (remote lacks it).
            if (!rOvr || !Object.prototype.hasOwnProperty.call(rOvr, k)) {
              localNewer = true;
            }
            mergedOvr[k] = { aisle: lOvr[k].aisle, ts: getTs(lOvr[k], 'ts') };
          }
        }
      }
      if (rOvr) {
        for (var k in rOvr) {
          if (Object.prototype.hasOwnProperty.call(rOvr, k)) {
            if (Object.prototype.hasOwnProperty.call(mergedOvr, k)) {
              var lTs = mergedOvr[k].ts;
              var rTs = getTs(rOvr[k], 'ts');
              if (rTs > lTs) {
                mergedOvr[k] = { aisle: rOvr[k].aisle, ts: rTs };
                changed = true;
              } else if (lTs > rTs) {
                localNewer = true;
              }
            } else {
              // Key only in remote (local lacks it).
              changed = true;
              mergedOvr[k] = { aisle: rOvr[k].aisle, ts: getTs(rOvr[k], 'ts') };
            }
          }
        }
      }
      state.ovr = mergedOvr;
    }

    // --- order (aisle order) ---
    var lOrd = local.order;
    var rOrd = remote.order;
    if (lOrd || rOrd) {
      if (lOrd && rOrd) {
        var lTs = getTs(lOrd, 'ts');
        var rTs = getTs(rOrd, 'ts');
        if (rTs > lTs) {
          state.order = { ids: rOrd.ids.slice(), ts: rTs };
          changed = true;
        } else if (lTs > rTs) {
          state.order = { ids: lOrd.ids.slice(), ts: lTs };
          localNewer = true;
        } else {
          state.order = { ids: lOrd.ids.slice(), ts: lTs };
        }
      } else if (lOrd) {
        state.order = { ids: lOrd.ids.slice(), ts: getTs(lOrd, 'ts') };
        localNewer = true;
      } else {
        state.order = { ids: rOrd.ids.slice(), ts: getTs(rOrd, 'ts') };
        changed = true;
      }
    }

    // --- other local fields preserved as-is ---
    var stdKeys = { items: true, meta: true, ovr: true, order: true };
    for (var k in local) {
      if (!stdKeys[k]) {
        state[k] = local[k];
      }
    }

    return { state: state, changed: changed, localNewer: localNewer };
  }

  return { merge: merge };
})();
