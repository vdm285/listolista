# ListoLista sync: instant, private, accountless, zero-cost options (verified, 2026-09-25)

- **Purpose:** input for design checkpoint 1 (branch `design/checkpoint-1`).
- **How this was made:** a research agent wrote a draft with 42 claims. A second agent then tried to refute it. It checked all 18 high-relevance claims and 18 others against their sources or better ones, re-ran the read-only broker probes from Victor's Mac, and re-read the code.
- **Verdict:** 30 claims confirmed, 6 corrected, 0 refuted, 6 not re-checked (marked *unverified*). The verification also turned up 8 things the draft missed (section 3.9).
- **Code state checked:** `index.html` at commit `2e5bc85` (2026-01-12). The live site https://vdm285.github.io/listolista/ serves the same code.
- **Only verified facts are stated as facts.** Design proposals are labelled as proposals.

---

## Bottom line

- **Anyone on the internet can read every shared list today.** They are stored as plain text on a public relay (HiveMQ). Their names are easy to find, because anyone who reads the open-source code can subscribe to all ListoLista topics at once.
- **A stranger could also inject code into the app.** A list title is shown in the Library view without being made safe first. Anyone can publish to a list's topic, so anyone can plant a title that runs code in Victor's browser.
- **One change fixes both: end-to-end encryption.** The phone encrypts the list with a secret key. The key lives only in the part of the share link after `#`, which browsers never send to any server. The relay only ever sees scrambled data it cannot read or forge.
- **The current relay is not a safe foundation.** HiveMQ's free public broker says it "must not be used in Production". Today it sometimes took 7-9 seconds to connect. It is acceptable as a stopgap, not as the long-term base.
- **Best free long-term relay: a small Cloudflare Worker with one "Durable Object" per list.** Victor makes one free Cloudflare account ("no credit card required", per Cloudflare). Users need nothing. The cost is $0 up to roughly 5,000-10,000 lists in use per day, then $5 a month.
- **The Google Sheet idea works for two people, but it is not instant.** Apps Script can only be polled; it cannot push updates. It also has a hard cap of 30 simultaneous runs shared by every user. Keep it for later as an optional "export to Sheet" feature.
- **Firebase is a sound Plan B for family scale.** Its free plan stops at 100 simultaneous connections, and the add-on library is about 114 KB.
- **The current sync code has a bug.** A phone that was offline can overwrite the shared copy with a list that is missing the other phone's new items. Checkpoint 1 fixes it.
- **On iPhone, two details decide whether this works.** First, add the app to the Home Screen: Safari may erase a site's saved data after 7 days of Safari use without visiting the site, but Home Screen apps are exempt. Second, the app's manifest must not set a fixed start page, or the Home Screen icon will open without the list's key. Test both on the second phone.
- **Keep the simple merge rule:** for each item, the latest change wins. Load Yjs (about 25-30 KB) only if two people really edit the same line at the same moment. Loro and Automerge (about 1.1 MB each) are too heavy for this app.

---

## 1. Measured today (2026-09-25, from Victor's Mac)

Probes used standard-library Python only. They **subscribed only**: nothing was published and no list contents were printed.

| Test | Result | Draft said | Status |
|---|---|---|---|
| Subscribe `listolista/#` on broker.hivemq.com | Granted. 9 retained plaintext snapshots (topics under v2, v3, v4, v6, sandbox), 10,347 bytes; largest about 50 items, 6,986 bytes | same | confirmed |
| Subscribe `#` (everything) | HiveMQ refused (0x80), EMQX refused, test.mosquitto.org granted (532 retained messages in 1.5 s) | Mosquitto: 1,076 in 1 s | confirmed (the count varies) |
| Subscribe `+/v2/+/data` on HiveMQ | Granted, 2 retained ListoLista snapshots | same | confirmed |
| Newest timestamp inside the snapshots | 256 days old (2026-01-12, the same day as the last commit) and 268 days old (2025-12-31) | "retention about 8.5 months" | **corrected**, see 3.1 |
| HiveMQ: time from subscribe to the first retained message | 187-204 ms | publish-to-delivery 199 ms | consistent |
| **Connect time over secure WebSocket (TLS + upgrade + MQTT CONNACK), 5 tries each** | EMQX 0.54-0.61 s; Mosquitto 1.13-1.81 s; **HiveMQ 1.47-1.60 s, plus one try at 8.8 s** | not measured | **new** |
| Connect time over plain TCP port 1883, 6 tries each (+4 during the probes) | EMQX 0.19-0.69 s; Mosquitto 0.39-0.45 s; **HiveMQ 0.76-0.97 s, but 5 of 10 tries took 6.9-8.7 s** | not measured | **new** |
| mqtt.js from unpkg (unpinned) | Resolves to mqtt@5.16.0 (npm, 2026-09-16): 342,341 bytes, 105,031 gzipped | same | confirmed |
| Firebase 12.19.0 modules, gzipped | app 23.8 KB, database 49.0 KB, auth 41.5 KB, firestore 178.4 KB | same | confirmed |
| CRDT payloads, gzipped | Loro 1.16.3 WebAssembly 1.07 MB; Automerge 3.5.0 WebAssembly 1.14 MB; Yjs 13.6.33 23 KB for the core file plus its lib0 imports (about 28 KB per the draft's bundlephobia figure) | same | confirmed |

What this means: once a phone is connected, updates arrive in about 0.2 s. **Opening** a shared list takes 0.5-1.8 s before the first sync, and occasionally 7-9 s on HiveMQ. So the app must always draw from its local copy first and sync in the background, which it already does.

---

## 2. Problems in the current app (`index.html`, commit 2e5bc85)

| # | Problem | Lines | Effect | Fix (proposal) |
|---|---|---|---|---|
| P1 | Shared lists are published as plain JSON, retained, on a public broker | 261, 324-327, 577 | Anyone can read them (measured above) | End-to-end encryption (section 6) |
| P2 | Room id is `'room_' + Date.now().toString(36)` (8 characters from the creation millisecond) and travels in `?room=` | 372-377, 316-328 | The id can be guessed. It also reaches GitHub's servers and browser history | Random 128-bit secret in `#k=...` |
| P3 | **List title inserted as HTML:** ``div.innerHTML = `<strong>${meta.title}</strong>` `` | 621 (title arrives from the network at 545-549) | **New finding.** Anyone who publishes to a room topic can plant a title that runs script in the app's origin when the Library is opened. That script could read every list in localStorage. Found by reading the code; not exploited | Use `textContent`. Encryption also blocks forged messages (AES-GCM authentication) |
| P4 | Sync race: on connect the app subscribes, **publishes its own state (retained)** and only merges what arrives afterwards. `handleSync` never re-publishes the merged result | 522-531, 541-569 | A phone that was offline replaces the retained snapshot with its own copy, missing the other phone's new items. Local copies keep their items (the merge only adds), so nothing is lost on the two phones, but a new device opening the link sees an incomplete list until the next edit | Wait for the snapshot, merge, then publish if different. With the Cloudflare relay, use compare-and-set (section 5) |
| P5 | mqtt.js loaded unpinned from unpkg, render-blocking in `<head>`, even for local lists | 183 | Slower first paint. A future major version is picked up automatically. A third-party script can also read `location.hash`, so it would see the future `#` secret | Self-host a pinned copy and load it only for shared lists, or use native WebSocket (Cloudflare) |
| P6 | Presence published every 5 s. `renderPeers()` is empty, so it is never shown | 527-528, 711-715 | Wasted traffic and battery. A new `setInterval` is added on every reconnect, so timers pile up | Delete |
| P7 | Old app versions re-publish plaintext on open (`if (items.length > 0) publishState()`) | 530 | Wiping the old snapshots does not stick while any device still runs the old code on an old link | Deploy the new version first, then wipe |
| P8 | No manifest or service worker | whole file | No reliable home-screen app or offline start | Add in checkpoint 1 (see 3.7 for the iOS trap) |

---

## 3. Findings by option

### 3.1 Public MQTT brokers (current approach)

- **HiveMQ terms.** The public broker "must not be used in Production, Dev, Staging or UAT environments". HiveMQ "does not commit to an uptime percentage", warns it "may lead to message loss", may "ban users", and advises against personal data. Ports: 1883, 8000 (WebSocket), 8883, 8884 (TLS WebSocket). [HiveMQ public broker, mqtt-dashboard.com, undated, fetched 2026-09-25](https://www.mqtt-dashboard.com/)
- **test.mosquitto.org** allows "any application" but asks users not to "rely upon it for anything of importance". It runs experimental code. Port 8081 is WebSocket, encrypted, with no login. [test.mosquitto.org, mosquitto.org, undated, fetched 2026-09-25](https://test.mosquitto.org/)
- **EMQX** presents its public broker as "Built for developers to prototype, learn, and test MQTT". It publishes no uptime promise, rate limits or retention policy. [Free Public MQTT 5 Broker, emqx.com, undated, fetched 2026-09-25](https://www.emqx.com/en/mqtt/public-mqtt5-broker)
- **Retained messages.** One retained message per topic. A zero-byte retained publish deletes it. In MQTT 3.1.1 there is no built-in expiry; MQTT 5 can set one. [MQTT Essentials Part 8, hivemq.com, 2026-02-09](https://www.hivemq.com/blog/mqtt-essentials-part-8-retained-messages/)
  - Consequence: anyone who knows a topic can also wipe or overwrite a list's shared copy (vandalism). Encryption stops forgery, but it cannot stop deletion on a public broker.
- **How long HiveMQ keeps retained messages (corrected).** The snapshots contain data last edited on 2026-01-12, but they may have been re-published later without changes, because the app re-publishes on every connect (P7). So this shows the data is still there, not that HiveMQ kept one message for 8.5 months. Most likely nobody opened those lists since January, but this is **unverified**.

### 3.2 Google Sheet + Apps Script (Victor's idea)

- **Quotas for consumer accounts:** 6 min per execution; **30 simultaneous executions per user**; 1,000 per script; 20,000 URL fetches a day. Quotas can change "without notice". [Quotas for Google Services, developers.google.com, updated 2026-09-03](https://developers.google.com/apps-script/guides/services/quotas)
  - With "execute as me", every visitor runs as Victor, so the 30 are shared by all users.
- **The 30-connection cap is real in practice.** tanaike measured the limit on simultaneous connections to one Web App as "under 30". Concurrent writes to a Sheet succeeded only up to about 60 users, and only with LockService and wait time. [Taking advantage of Web Apps with Google Apps Script, README v2.0.0, github.com/tanaikech, 2025-06-24 (last commit 2025-07-18)](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script/blob/master/README.md)
- **No push.** Apps Script has "No WebSocket or Server-Sent Events (SSE) support", so clients must poll. The feature request is open (opened 2025-08-28) and has no visible Google reply. It sits in a samples repository, not Google's official tracker, but no Apps Script API offers push. [apps-script-samples issue #557, github.com, opened 2025-08-28, open on 2026-09-25](https://github.com/googleworkspace/apps-script-samples/issues/557)
  - Long polling (holding a request open) is possible in principle, but each open request uses one of the 30 slots.
- **Anonymous access works.** `ANYONE_ANONYMOUS` means "Any user, even if not logged in". `USER_DEPLOYING` runs the app as the deployer. [Web Apps manifest resource, developers.google.com, updated 2026-09-03](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- **Calling it from github.io works if done a certain way.** There is no CORS error when `doGet`/`doPost` return `ContentService` text and POST bodies are strings (tanaike README, "CORS in Web Apps" section, same source as above).
- **Calling the Sheets API directly from the browser** has per-minute quotas of 300 reads and 300 writes per project, and 60 per user. [Sheets API usage limits, developers.google.com, updated 2026-09-03](https://developers.google.com/workspace/sheets/api/limits)
  - Writing requires a Google OAuth login, which breaks the "no account" rule. The draft sourced this from the authorization guide; that page was not re-opened.
- *Unverified (not re-checked):* the 2025-11 forum report of Web App POSTs failing with HTTP 500.

### 3.3 Firebase (Google-managed, Plan B)

- **Spark (free) quotas.** Realtime Database: **100 simultaneous connections**, 1 GB stored, 10 GB downloaded a month. Firestore: 1 GiB stored; 50K reads, 20K writes and 20K deletes a day. Authentication: 50K monthly active users at no cost. [Firebase pricing, firebase.google.com, fetched 2026-09-25](https://firebase.google.com/pricing); [Realtime Database limits, firebase.google.com, updated 2026-09-24](https://firebase.google.com/docs/database/usage/limits)
- **No surprise bills.** Spark needs "No payment information". When a quota is exceeded, the product is "shut off for the remainder of that month". [Firebase pricing plans, firebase.google.com, updated 2026-09-24](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- **No offline storage on the web.** The Realtime Database web SDK keeps offline writes in memory only and does not cache reads; the feature request is still open. ListoLista would keep its own local copy anyway. [firebase-js-sdk issue #7442, github.com, opened 2023-07-11, open on 2026-09-25](https://github.com/firebase/firebase-js-sdk/issues/7442)
- **Size:** about 114 KB gzipped for app + database + auth (measured, section 1).
- **Only 2026 change found:** Remote Config fetches get a daily free cap from 2026-09-01. It is not relevant here (pricing page, same fetch).

### 3.4 Cloudflare Worker + Durable Object (recommended relay)

- **Free plan since 2025-04-07.** Durable Objects "can now be used with zero commitment on the Workers Free plan", SQLite-backed only. [Durable Objects on Workers Free plan, developers.cloudflare.com changelog, 2025-04-07](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/)
- **Free inclusions per day:** 100,000 Durable Object requests; 13,000 GB-s of compute; 5M SQLite rows read; **100,000 rows written**; 5 GB storage in total.
  - Incoming WebSocket messages are billed at 20:1. Outgoing messages and protocol pings are free.
  - Objects "idle and eligible for hibernation are not billed for duration".
  - Deletes count as rows written, and the simple `put()`/`get()` storage calls are billed as rows.
  - Source: [Durable Objects pricing, developers.cloudflare.com, updated 2026-08-25](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- **Per-object limits:** 1 GB storage per object on Free, a soft limit of 1,000 requests per second per object, and up to 32 MiB per received WebSocket message. [Durable Objects limits, developers.cloudflare.com, updated 2026-06-01](https://developers.cloudflare.com/durable-objects/platform/limits/)
- **Workers Free:** 100,000 requests a day, reset at 00:00 UTC; 10 ms CPU per request. When the daily limit is exceeded it either fails "closed" (error 1027) or fails "open" (skips the Worker). [Workers limits, developers.cloudflare.com, updated 2026-09-05](https://developers.cloudflare.com/workers/platform/limits/)
- **Workers Paid:** $5 a month minimum. It includes 10M Worker requests, 1M Durable Object requests and 400,000 GB-s a month. [Workers pricing, developers.cloudflare.com, updated 2026-08-28](https://developers.cloudflare.com/workers/platform/pricing/)
- **No card needed.** "Start building for free — no credit card required." [Cloudflare Workers, workers.cloudflare.com, fetched 2026-09-25](https://workers.cloudflare.com/)
  - The docs themselves do not mention cards; confirm at sign-up.
- **Hibernation keeps idle phones free.** With the Hibernation API, "WebSocket clients remain connected" while the object is evicted, and protocol ping frames get automatic pongs "without interrupting hibernation". [Use WebSockets, developers.cloudflare.com, updated 2026-06-19](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
  - Browsers cannot send protocol pings from JavaScript. An app-level heartbeat should use `setWebSocketAutoResponse`, which answers "without waking" the object. [Durable Object State API, developers.cloudflare.com, updated 2026-08-26](https://developers.cloudflare.com/durable-objects/api/state/)
  - `setTimeout`/`setInterval` inside the object prevent hibernation, so use no timers there.
- **PartyKit is now part of Cloudflare.** It was announced 2024-04-05 ([PartyKit is joining Cloudflare, blog.partykit.io, 2024-04-05](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/)). Its open-source successors (partyserver 0.5.10, partysocket 1.3.0, y-partyserver 2.2.0) run on Durable Objects. partysocket is 4,031 bytes gzipped (bundlephobia, measured 2026-09-25). [cloudflare/partykit, github.com, fetched 2026-09-25](https://github.com/cloudflare/partykit)

**Capacity estimate (proposal, recomputed; the draft's figure was too optimistic).**

Assumptions for one list in use for one day: 2 phones, each reconnecting about 5 times as it sleeps and wakes (10 Worker requests and 10 Durable Object requests), 40 edits (40 incoming messages, billed as 2 requests), and 5-10 batched SQLite writes.

| Free-plan limit | Use per list per day | Lists per day before the limit |
|---|---|---|
| Durable Object requests (100k) | about 12 | about 8,000 |
| Worker requests (100k) | about 10 | about 10,000 |
| Rows written (100k) | 5-10 | 10,000-20,000 |

So the free plan covers **roughly 5,000-10,000 lists in use per day**. Reconnections, not edits or writes, are what run out first. The draft said rows written would run out first.

### 3.5 Other options checked

| Option | Verified facts | Verdict |
|---|---|---|
| ntfy.sh | Messages are cached "12h by default". "The topic name is your password". Free rate: "60 requests as a burst, and then 1 request per 10 seconds". Runs "best effort" on a single server. [ntfy FAQ, docs.ntfy.sh, fetched 2026-09-25](https://docs.ntfy.sh/faq/). *Unverified:* 4,096-byte limit and 250 messages a day per IP (not re-checked) | A notification pipe, not a store. Rule out |
| Nostr relays | NIP-78 now says relays SHOULD require NIP-42 AUTH for app data (merged 2026-09-03, PR #2458) ([NIP-78, github.com/nostr-protocol, 2026-09-03](https://github.com/nostr-protocol/nips/blob/master/78.md)). An objection is open ([issue #2473, github.com, 2026-09-20](https://github.com/nostr-protocol/nips/issues/2473)). nostr-tools 2.25.2 is from 2026-09-04 (npm). *Unverified:* library size, and relay retention in practice | Retention is unclear and the rules are in flux. Not the main store |
| WebRTC P2P (Trystero 0.25.4, 2026-08-30) | Handshake via Nostr (default), MQTT, BitTorrent, Supabase, Firebase, IPFS or a self-hosted relay. Some networks block P2P, so a TURN relay is needed (the README cites Cloudflare's free 1,000 GB). The README suggests "an always-on peer" for "remembering the last state". [Trystero README, github.com/dmotz, fetched 2026-09-25](https://github.com/dmotz/trystero) | Fails "phones online at different times" unless there is a server peer. Rule out |
| TURN need | "Anything between 0 and 50 percent" of sessions go via relay. "Carrier-grade NAT on mobile operators behaves like a symmetric NAT". [TURN glossary, bloggeek.me, updated Sep 2026](https://bloggeek.me/webrtcglossary/turn/) | Explains Victor's failed Wi-Fi to 4G test |
| Supabase Free | 2 active projects; 500 MB database; 200 realtime connections; 2M realtime messages a month; paused after 1 week of low activity, restorable for 1 year. [Supabase pricing, supabase.com, fetched 2026-09-25](https://supabase.com/pricing); [Free project pausing, supabase.com, fetched 2026-09-25](https://supabase.com/docs/guides/platform/free-project-pausing) | Workable, but the pause rule is a nuisance. Not preferred |
| Instant | "New signups are closed". Cloud apps shut down on 2027-08-31. Open source, can be self-hosted. [The Instant team joins OpenAI, instantdb.com, announced 2026-08-22 per news coverage](https://www.instantdb.com/essays/instant_team_joins_openai) | Rule out |
| Jazz | The homepage leads with "Jazz v2 alpha" and usage-based pricing that **does** list included allowances (1 GB storage and 5 GB egress a month, a 1 GB RAM instance). Classic Jazz is still linked. [jazz.tools, fetched 2026-09-25](https://jazz.tools/) | Alpha. Rule out for now |
| Ably Free (new) | 6M messages a month, 200 concurrent connections, 1-day history. [Ably pricing, ably.com, fetched 2026-09-25](https://ably.com/pricing) | Would need an API key in public code or a token server. Not preferred |
| Liveblocks, hosted MQTT (HiveMQ Cloud and EMQX Serverless), Cloudflare TURN details | *Unverified* (not re-checked; low relevance) | Not preferred: proprietary, or shared credentials embedded in public code |

### 3.6 Encryption building blocks

- **The `#` part stays in the browser.** "The fragment is not sent to the server when the URI is requested". [URI fragment, MDN, updated 2026-06-22](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)
  - Scripts running on the page can still read it, which is why P5 (a third-party script) matters.
- **AES-GCM is authenticated.** It "includes checks that the ciphertext has not been modified by an attacker"; the MDN example uses a random 12-byte IV. [SubtleCrypto.encrypt, MDN, updated 2026-09-14](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- **Never reuse an IV.** The IV "must be unique for every encryption operation carried out with a given key"; 96 bits is recommended. Additional data is authenticated but not encrypted. [AesGcmParams, MDN, updated 2025-06-23](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- *Unverified (not re-checked):* Excalidraw's 2020 key-in-fragment design, which the draft cited as a precedent.

### 3.7 iPhone and home-screen behaviour

- **Separate storage.** Home Screen apps "are created as isolated entities without shared state with the browser" (WebKit engineer, "by design"). [WebKit bug 181849, bugs.webkit.org, reported 2018-01-19, last comment 2022-02-02 (older source)](https://bugs.webkit.org/show_bug.cgi?id=181849)
- **7-day cap (new finding).** Safari deletes all of a site's script-writable storage (localStorage, IndexedDB, service worker) "after seven days of Safari use without user interaction on the site". Home Screen apps "have their own counter". [Full Third-Party Cookie Blocking and More, webkit.org, 2020-03-24 (older source; no newer source found that reverses it)](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
  - A list used in Safari only once a week can lose its local copy and its key. The WhatsApp message with the link is then the key backup, and the relay holds the data.
- **Persistent storage on request.** WebKit grants `persist()` "based on heuristics like whether the website is opened as a Home Screen Web App". [Updates to Storage Policy, webkit.org, 2023-08-10](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Start-page trap (correction).** If a manifest has no valid `start_url`, "the URL of the page that links to the manifest is used" ([start_url, MDN, updated 2026-08-31](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)). iOS Safari **does** use `start_url` when one is set: a `"start_url": "/"` made iPhones save the wrong page, and removing it fixed that ([PairDrop issue #329, github.com, 2024-09-04](https://github.com/schlagmichdoch/PairDrop/issues/329)).
  - So ListoLista's manifest must **omit `start_url`**.
  - Whether iOS keeps the `#k=` part when saving to the Home Screen is **unverified**. Test it on the device.

### 3.8 Merge model and library sizes

- **Library sizes** measured today are in section 1. Yjs is small enough to load only when needed. Loro and Automerge ship over 1 MB of gzipped WebAssembly each.
- **Merge rule (proposal).** Keep "latest change per item wins", with deletion markers. Replace wall-clock timestamps with a per-item counter plus a device id, so one phone with a wrong clock cannot win forever. In "paper" mode, give each line a hidden id.

### 3.9 Things the draft missed

1. **Connection time.** Opening a list takes 0.5-1.8 s to connect, with 7-9 s stalls on HiveMQ today (section 1). HiveMQ was the slowest of the three brokers to connect.
2. **Code injection through the list title** (P3).
3. **Safari's 7-day storage cap** (3.7).
4. **iOS honours `start_url`** (3.7).
5. **Third-party scripts can read the `#` secret** (P5).
6. **Old app versions re-publish plaintext** (P7), which affects the wipe plan.
7. **Presence traffic is never displayed** (P6).
8. **Ably** as another hosted option (3.5).

---

## 4. Comparison of sync options (corrected)

Legend: OK = good fit, ~ = workable with caveats, X = fails the requirement.

| Option | Push speed | Phones online at different times | Terms / reliability | Free limits that matter | Victor's one-time setup | End-user account | Cost at stage 1 / 2 / 3 | Client size (gzip) | Lock-in |
|---|---|---|---|---|---|---|---|---|---|
| Public MQTT (HiveMQ / EMQX / Mosquitto) + encryption | OK: about 0.2 s once connected; connect 0.5-1.8 s, HiveMQ stalls 7-9 s | ~ retained snapshot, no promise | X HiveMQ forbids production; EMQX for testing; Mosquitto: "any application", don't rely on it | none published; anyone can wipe a topic | none | none | $0 / $0 (terms risk) / $0 (ban risk) | mqtt.js 105 KB | low |
| Google Sheet + Apps Script | X polling only | OK | ~ quotas "may change without notice" | 30 simultaneous runs for everyone | Google script + deployment | none | $0 / ~ / X | 0 KB | medium |
| Sheets API from the browser | X polling | OK | OK | 300 requests a minute per project | Google Cloud project + OAuth | X Google login | n/a | ~ | high |
| Firebase Realtime DB (Spark) | OK | OK | OK | 100 simultaneous connections; switched off for the month when exceeded | Firebase project + rules | none | $0 / $0 / X (Blaze needs a card) | about 114 KB | high |
| Firestore (Spark) | OK | OK | OK | 50K reads, 20K writes a day | same | none | $0 / $0 / ~ | about 202 KB | high |
| **Cloudflare Worker + Durable Object** | OK | OK (SQLite per list) | OK production service | 100k requests a day, 100k rows written a day, 5 GB | free account + deploy about 150 lines | none | $0 / $0 / $0 to about 5-10k lists a day, then $5 a month | 0 KB (native WebSocket) | low (small, portable code) |
| ntfy.sh | ~ | X 12-hour cache | ~ best effort | 1 request per 10 s after a burst | none | none | ~ | 0 KB | low |
| Nostr relays | OK | ~ no retention promise | ~ rules in flux | varies by relay | none | none | $0 (uncertain) | library required | low |
| WebRTC P2P (Trystero) | OK when connected | X both must be online | ~ | TURN needed on mobile | TURN account | none | $0, but fails on 4G without TURN | small + signalling | low |
| Supabase Free | OK | OK | ~ pauses after 1 week idle | 200 connections, 2M messages a month | project + row-level security | none | $0 / $0 / ~ | about 56 KB (draft figure, *unverified*) | medium |
| Ably Free | OK | ~ 1-day history | OK | 6M messages a month, 200 connections | account + key/token server | none | $0 / $0 / X | SDK | high |
| Instant / Jazz v2 | n/a | n/a | X shutting down / alpha | n/a | n/a | n/a | n/a | n/a | n/a |

---

## 5. Recommendation for checkpoint 1

**Goal:** two people in one household share lists instantly, privately, with no accounts and at zero cost, on the code base that will scale later.

1. **Fix what is broken first (no decision needed).**
   - Make list titles safe (P3).
   - Remove the presence loop (P6).
   - Stop loading mqtt.js in `<head>` (P5).
   - Fix the publish-before-merge race (P4).
2. **Add end-to-end encryption (section 6).** Links become `https://vdm285.github.io/listolista/#k=<secret>`. The relay sees only a room id derived from the secret and encrypted blobs.
3. **Put all network code behind one small "relay" interface** (connect, get snapshot, put snapshot, on update). The relay can then change without touching the rest of the app.
4. **Choose the relay. Victor decides:**
   - **Option A (recommended): Cloudflare Worker + Durable Object now.**
     - Victor's part: create a free Cloudflare account and log in once from the terminal so the relay can be deployed (about 30-60 minutes, once).
     - What it buys: it removes the terms risk and the connection stalls, it needs no client library, and it replaces the retained-message race with compare-and-set. It is also where stages 2-3 end up anyway, so nothing is built twice.
   - **Option B (zero setup, stopgap): encrypted MQTT.**
     - Use EMQX (fastest to connect today), with HiveMQ as a second broker.
     - Load mqtt.js only for shared lists, from a pinned copy in the repo.
     - Accept the "testing only" terms, the occasional stall, and that anyone can wipe a topic.
     - Move to Option A at stage 2.
5. **Make the relay rules simple (proposal for Option A).** One Durable Object per room id stores `{version, blob}` in SQLite and broadcasts to connected phones.
   - A client sends `put {baseVersion, blob}`. The relay accepts it only if `baseVersion` matches; otherwise it returns the newer blob, and the client merges and retries.
   - Use the Hibernation API with no timers, and `setWebSocketAutoResponse` for heartbeats.
   - Cap blob size (for example 64 KB) and the message rate per room.
   - Optional: derive a write token from the secret, so people who only know the room id (for example from logs) cannot overwrite a list.
6. **Home-screen app.**
   - Add a manifest **without `start_url`** and a service worker that caches the app shell.
   - Keep each list's secret in localStorage too, so the Library can reopen lists.
   - On the second phone, test that "Add to Home Screen" from a shared link opens that list offline (3.7).
7. **Clean up old data (needs Victor's OK, because it writes to a public service).**
   - First deploy the new version.
   - Then publish zero-byte retained messages to the 9 old ListoLista topics on HiveMQ, and stop using `?room=` links.
   - Old lists: start fresh, or migrate once (read, re-encrypt, wipe).
8. **Leave for later:** the "export to Google Sheet" power feature, Yjs co-editing (only if tests show same-line conflicts), and a "new secret link" menu action for leaked links.

**Stages 2-3:** the same design. Watch the daily request counters in the Cloudflare dashboard. If the free tier runs out, Workers Paid is $5 a month, which could be funded by the donate button.

---

## 6. End-to-end encryption design sketch (proposal; building blocks verified in 3.6)

```js
// create a list
const secret = crypto.getRandomValues(new Uint8Array(16));            // 128-bit, 22 chars base64url
const link = `${location.origin}${location.pathname}#k=${b64url(secret)}`;
// derive (never send the secret anywhere)
const roomId = b64url(await crypto.subtle.digest('SHA-256', concat(utf8('listolista/room/v1'), secret))).slice(0, 22);
const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  {name: 'HKDF', hash: 'SHA-256', salt: utf8('listolista'), info: utf8('aes-gcm-256/v1')},
  ikm, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
// seal every message with a fresh random IV (never reuse an IV with the same key)
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: utf8(roomId)}, key,
                                       utf8(JSON.stringify(state)));
send({v: 1, iv: b64url(iv), ct: b64url(ct)});
```

- **The relay cannot see:** item text, the title, done or deleted flags, or the item count (if padded to 1 KB steps).
- **The relay can see:** the room id, IP addresses, timing, message sizes and the number of devices.
- **Replay:** someone who holds an old encrypted blob can re-send it. The per-item merge ignores older changes, so phones lose nothing, but the stored copy can go stale until the next edit. Compare-and-set on the relay limits this.
- **Leaked link:** whoever has it can read and edit forever. The only remedy is rotation: a new secret, a new room, and re-sharing the link.

---

## 7. Corrections from verification

| Claim | Draft said | Verified |
|---|---|---|
| C6 retention | HiveMQ kept retained copies "about 8.5 months" | The **data** is from 2025-12-31 and 2026-01-12. The **messages** may have been re-published later, because the app re-publishes on every connect. Retention is *unverified* |
| C10 / summary "instant" | 150-250 ms | True once connected. Opening a list adds 0.5-1.8 s to connect, and HiveMQ stalled 7-9 s in half of the plain-TCP tries today |
| Capacity (stage 3) | "about 10,000 active lists a day; rows written run out first" | About 5,000-10,000. Reconnects, which count as Worker and Durable Object requests, run out first |
| C23 hibernation | "ping/pong handled automatically" | Only for protocol pings, which browsers don't send. Use `setWebSocketAutoResponse` for app heartbeats, and no timers in the object |
| C28 Trystero | "README says nothing about persistence" | The README suggests an always-on server peer for "remembering the last state", which confirms that P2P alone needs a server for this |
| C29 TURN share | "10-20% of sessions" | "Anything between 0 and 50 percent", depending on users (BlogGeek, Sep 2026). Mobile carrier NAT is a main cause (confirmed) |
| C34 Jazz | "advertises no free tier" | v2 pricing lists included allowances. It is still alpha, so the verdict is unchanged |
| C38 source | MDN `encrypt` page on IV reuse | The IV-uniqueness rule is on MDN `AesGcmParams` (2025-06-23), not on the `encrypt` page |
| C40 iOS | "the secret must be in the URL when she taps Add to Home Screen" | Also: iOS uses the manifest `start_url` if set, so it must be omitted. Safari's 7-day storage cap makes the home-screen install important |
| Summary, Nostr | "a rule change on 2026-09-20 is disputed" | The rule change was merged on 2026-09-03; the objection was filed on 2026-09-20 |
| Recommendation, wipe | "wipe the 9 snapshots first" | Deploy the new code **first**. Old code re-publishes the plaintext whenever an old link is opened |

---

## 8. Claim ledger (from the draft)

| ID | Topic | Status |
|---|---|---|
| C1 | HiveMQ public-broker terms | confirmed |
| C2 | test.mosquitto.org terms, port 8081 | confirmed |
| C3 | EMQX public broker purpose | confirmed |
| C4 | 9 plaintext lists readable on HiveMQ | confirmed (re-measured) |
| C5 | `#` refused by HiveMQ/EMQX, prefix wildcards allowed, Mosquitto allows `#` | confirmed (Mosquitto count varies) |
| C6 | retention about 8.5 months | **corrected** |
| C7 | timestamp room ids in `?room=`, plaintext topics, 5-s presence | confirmed (code) |
| C8 | publish-before-merge bug | confirmed (code); the effect is on the shared snapshot, not on local copies |
| C9 | unpinned, render-blocking mqtt.js 5.16.0, 105 KB | confirmed (re-measured) |
| C10 | publish-to-delivery latency | confirmed indirectly (round trips of about 0.2 s); connection time added |
| C11 | Apps Script quotas | confirmed |
| C12 | 30-connection cap, 60-user write test | confirmed |
| C13 | no WebSocket/SSE in Apps Script | confirmed |
| C14 | anonymous access + CORS recipe | confirmed |
| C15 | Web App HTTP 500 report | unverified |
| C16 | Sheets API per-minute quotas | confirmed |
| C17 | Firebase Spark quotas | confirmed |
| C18 | Spark shut-off, no card | confirmed |
| C19 | no offline storage in the RTDB web SDK | confirmed |
| C20 | Firebase SDK sizes | confirmed (re-measured) |
| C21 | Durable Objects free inclusions | confirmed |
| C22 | Workers Free/Paid limits | confirmed |
| C23 | hibernation | confirmed, with nuance (section 7) |
| C24 | PartyKit part of Cloudflare | confirmed |
| C25 | ntfy is not a store | confirmed (core); the 4 KB and 250-a-day figures unverified |
| C26 | Nostr kinds, nostr-tools size | unverified (version and date confirmed only) |
| C27 | NIP-78 AUTH dispute | confirmed (the change dates from 2026-09-03) |
| C28 | Trystero | **corrected** |
| C29 | TURN percentage | **corrected** |
| C30 | TURN free tiers | unverified |
| C31 | Supabase Free | confirmed |
| C32 | Liveblocks Free | unverified |
| C33 | Instant shutdown | confirmed |
| C34 | Jazz | **corrected** |
| C35 | CRDT sizes | confirmed (re-measured wasm) |
| C36 | fragment not sent | confirmed |
| C37 | Excalidraw precedent | unverified |
| C38 | AES-GCM IV rules | **corrected** (source) |
| C39 | zero-byte retained delete | confirmed |
| C40 | iOS home-screen storage | **corrected** |
| C41 | hosted MQTT free tiers | unverified |
| C42 | GitHub Pages limits | confirmed |

---

## 9. Open questions / for Victor

1. **Relay for checkpoint 1.**
   - Option A: Cloudflare now. It needs about 30-60 minutes of your time once, to create a free account and log in.
   - Option B: encrypted public MQTT as a zero-setup stopgap, with a move to Cloudflare at stage 2.
   - Recommendation: A.
2. **Old lists.** OK to start fresh and wipe the 9 old plaintext snapshots on HiveMQ after the new version is live? Or should each old list be migrated once? The wipe writes to a public service, so it needs your yes.
3. **The second phone.** iPhone or Android? On iPhone, someone will need to test that "Add to Home Screen" from a shared link opens the right list offline. It is not known whether iOS keeps the `#k=` part.
4. **"Paper" mode.** Will two people really type in the same line at the same moment? If not, the simple per-line rule is enough and Yjs is never loaded.
5. **Your Sheet idea.** Is an "export to Google Sheet" feature for your data analysis wanted later? Apps Script speed from Mexico was not measured. A 15-minute prototype could measure it if you want evidence.
6. **Link-leak policy.** Is "the link is the key; rotate if leaked" acceptable UX for the family stage?
7. **Still unknown:**
   - How long EMQX and Mosquitto keep retained messages.
   - Whether major Nostr relays serve kind 30078 without AUTH after the 2026-09 change.
   - Whether Cloudflare sign-up really asks for no card: the marketing page says so, but it has not been tried.
