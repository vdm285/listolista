# ListoLista platform research: installable web app, offline use, iPhone and Android capabilities (verified 2026-09-25)

- **Scope:** the web platform as of September 2026 for ListoLista, an installable, offline-first shopping-list app hosted on GitHub Pages.
- **Method:** a draft research result (45 claims) went through an adversarial fact-check. Every high-relevance claim and most of the others were re-opened at the source or at a better one, and dates were confirmed. Newer information was looked for; the Safari 26.2, 26.4 and 26.6 release notes were also read.
- **Result:** 34 claims confirmed, 11 corrected (one of them only for dates), 0 refuted, 0 left unverified. Several important items the draft missed were added and are marked **[new]**.
- **Branch:** `design/checkpoint-1`. This file is the only change.
- **Evidence rules:** anything that rests only on reading the code, or only on one developer report, says so. Sources older than 2024 are marked **[older]**.

---

## Bottom line (plain language)

- **Installing on iPhone is manual but easy.** Since iOS 26, any site added to the Home Screen opens as its own app, and it needs no special setup. A web page still cannot show an "Install" button on iPhone. We can only show a short hint with the steps. On Android, a real "Instalar" button is possible.
- **On iPhone, the installed app and Safari do not share data. This is the biggest trap.** A list opened in Safari from a WhatsApp link does not appear inside the installed icon. Each icon also keeps its own separate data. The icon opens the address written in the app's settings file, not the page that was on screen. The room link must be built into the installed app, or the app must make it easy to paste the link once. This needs a 15-minute test on your wife's iPhone.
- **Lists are not wiped on iPhone if the app is installed.** Safari deletes a site's data after 7 days of Safari use without a visit. Installed Home Screen apps keep their own day counter, so a list that is used regularly is safe.
- **"Zero clicks" is not possible on the web. The minimum is one tap.** iPhone refuses by design to open the keyboard until the user taps. Android behaves the same for web pages. The best we can do is make one tap anywhere on the list open the keyboard, and keep the keyboard up while items are added.
- **Voice works today with no code.** The mic key on the keyboard already handles Mexican Spanish: iOS 27 dictation on the phone itself, and Gboard on Android. A voice button inside the app can come later. On Android it would need the internet, and on iPhone it is still unreliable.
- **Today's biggest speed and offline problem is one external file.** The app downloads a 342 KB messaging library (MQTT, the protocol the shared lists use) from a public CDN before it shows anything. That library is 3.4 times the size of the whole app. It is not pinned to a version: it updated itself to a new release on 2026-09-16. When the phone is offline, a shared list gets stuck on "Conectando..." (found by reading the code). The first fix is to show the list first, connect afterwards, and pin and self-host the library.
- **"One file you can download and open" only works on a computer.** An iPhone cannot run a downloaded HTML file, and offline support needs a few small extra files on the website. The honest promise is "one main file, plus small helper files for offline use".
- **The free public message server is only meant for testing [new].** HiveMQ's public broker is described as "not intended for private or production data". Today's room codes are made from the current time, so they can be guessed. Treat the server's copy of a list as convenient, not as a backup, and switch to long random room codes.
- **GitHub Pages is fine for checkpoint 1.** Two things to know. Every push to `main` goes live to your wife within about 10 minutes. Changing to a custom domain later would "reset" installs and local lists, so decide on the domain before the friends-and-family stage.

---

## 1. Installing the app

### iPhone (iOS 26 and 27)
- Since iOS/iPadOS 26, every site added to the Home Screen opens as a web app by default. An "Open as Web App" toggle lets the user choose a plain bookmark instead. WebKit says there are "zero requirements for 'installability' in Safari". A manifest is optional, but its icons and other settings are still used. [WebKit Features in Safari 26.0, webkit.org, 2025-09-15](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- There is no install-prompt API: Safari and iOS Safari do not support `beforeinstallprompt`. [MDN browser-compat-data v8.1.3, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data)
- The steps on iOS 26: the ⋯ button next to the address bar → Share → Add to Home Screen → "Open as Web App" (on by default) → Add. [MacRumors how-to, macrumors.com, 2025-08-20](https://www.macrumors.com/how-to/save-safari-bookmark-web-app-iphone-home-screen/)
- **[new]** Since iOS 16.4, third-party browsers such as Chrome can also offer "Add to Home Screen" in the Share menu. [WebKit Features in Safari 16.4, webkit.org, 2023-03-27](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) **[older]**
- Safari 27 adds nothing for install, manifests, keyboard, speech, share, wake lock, badging or WebSockets. Its only relevant web-app item is the Service Worker static routing API. [WebKit Features for Safari 27.0, webkit.org, 2026-09-17](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)
  - **[new]** The Safari 26.2, 26.4 and 26.6 release notes also contain nothing that changes these conclusions. Safari 26.4 added WebTransport, which is not needed now. [Safari 26.2, webkit.org, 2025-12-12](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/); [Safari 26.4, webkit.org, 2026-03-24](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/); [Safari 26.6, webkit.org, 2026-07-27](https://webkit.org/blog/18178/webkit-features-for-safari-26-6/)

### Android (Chrome)
- Chrome's installability requirements:
  - the manifest has `name` or `short_name`;
  - icons of 192 px and 512 px;
  - `start_url`;
  - `display` or `display_override`;
  - `prefer_related_applications` absent or false;
  - the page is served over HTTPS.

  A service worker is not required. Firefox does not support manifest-based install. [Making PWAs installable, MDN, 2026-09-07](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
  - The compatibility data for `start_url` also notes that Chrome requires it for install. [BCD manifests/webapp/start_url, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data/tree/main/manifests/webapp)
- For a custom install button: listen for `beforeinstallprompt`, call `preventDefault()`, keep the event, and call `prompt()` when the user taps your button. Only Chromium browsers support it (Chrome 61+, partial from 44). **Correction:** the compatibility data marks it as standards-track (WICG Manifest Incubations), not "non-standard". [beforeinstallprompt event, MDN, 2026-07-28](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
- Since 2023, Chrome no longer requires a service-worker `fetch` handler for installing from the menu (mobile since version 108). **Correction:** the source says Chrome's *own install prompt* still needs a fetch handler; it does not say whether `beforeinstallprompt` needs one. This makes no difference in practice, because our `sw.js` will have a fetch handler anyway. [Revisiting Chrome's installability criteria, Chrome for Developers, 2023-12-05](https://developer.chrome.com/blog/update-install-criteria) **[older]**
- Chrome's new Web Install API (`navigator.install()` and `<install>`) has an Intent to Ship for Chrome 156, **desktop only**. Android is deferred because of "significant technical deviation", and WebKit opposes the feature. So phones will have no cross-platform install button in 2026. [Intent to Ship: Web Install API, blink-dev, 2026-09-21](http://www.mail-archive.com/blink-dev@chromium.org/msg17503.html)

### Icons and cosmetics
- iOS uses manifest icons only when there is no `apple-touch-icon` and the icon's purpose is `any` or unspecified (iOS 15.4+).
- Safari 26 accepts SVG and data-URL icons.
- iOS does not support manifest `shortcuts` or `share_target`; Chrome Android supports both. [BCD manifests/webapp, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data/tree/main/manifests/webapp); [Safari 26.0, webkit.org, 2025-09-15](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- The `display-mode` media query works in iOS Safari 12.2+ and Chrome 42+. The page can therefore show the install hint only in the browser and hide it inside the installed app. [BCD css/at-rules/media, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/media.json)
- In one developer's installed app on iOS 27, the status-bar style `black-translucent` produced a Liquid Glass blur over the header; switching to `default` fixed it. This is a single report. [fin-app issue #411, GitHub, 2026-09-17](https://github.com/MrClit/fin-app/issues/411)

---

## 2. Storage, isolation and the start URL

### iPhone: the installed app is a separate world
- A Home Screen web app does not share cookies, localStorage or its service worker with Safari. An Apple WebKit engineer wrote that "The current behavior (on Apple platforms) is by design". The bug is still open. [WebKit bug 181849, bugs.webkit.org, comment 2022-02-01](https://bugs.webkit.org/show_bug.cgi?id=181849)
- **[new]** Each installation on iOS gets its own isolated storage and is treated as a separate app. On Android, repeated installs point to the same instance and the same storage. [Installation, web.dev Learn PWA, 2024-09-20](https://web.dev/learn/pwa/installation/)
  - For ListoLista this means one icon per list would give each icon its own "Mis Listas" library. One icon for everything is simpler.

### The icon opens `start_url`, not the page on screen
- If a manifest sets `start_url`, iOS launches from it, not from the page on screen when the user added the icon.
  - GitLab's iOS users saw the Add to Home Screen sheet show the manifest's `/explore/projects` instead of the page they were on. [GitLab issue 427560, gitlab.com, 2023-10-08](https://gitlab.com/gitlab-org/gitlab/-/issues/427560) **[older]**
  - A 2026 report shows the same behaviour. [run-insights issue #107, GitHub, 2026-09-07](https://github.com/miftahulmahfuzh/run-insights/issues/107)
- **Correction:** the draft said this started with iOS 16.4. That boundary is not established; the compatibility data lists iOS support for `start_url` since 11.3.
- The Manifest spec rules:
  - If `start_url` is missing or invalid, it defaults to the document URL, including its query string.
  - `id` defaults to `start_url`.
  - `start_url` must be same-origin with the document.
  - It is "purely advisory": browsers may ignore it or let the user edit it.

  [Web Application Manifest, W3C Working Draft, 2026-08-13](https://www.w3.org/TR/appmanifest/)
- MDN warns against putting user identifiers in `start_url`, because they act as a persistent fingerprint. Our room code is a shared list ID, not a user ID. [start_url, MDN, 2026-08-31](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)
- **Implication (inference).** A manifest with no `start_url` would, by spec, keep `?room=…`. But Chrome requires `start_url` for installability (see §1), so leaving it out may cost the Android install button. This needs a device test (see Open questions).

### Android: shared with Chrome
- An installed PWA on Android (a WebAPK) uses Chrome's profile, so cookies and storage are shared with the browser tabs. [WebAPKs on Android, web.dev, 2017-05-21](https://web.dev/articles/webapks) **[older]**
  - A newer page agrees. [Installation, web.dev Learn PWA, 2024-09-20](https://web.dev/learn/pwa/installation/)

### The 7-day wipe and persistent storage
- Safari deletes all script-writable storage (IndexedDB, localStorage, sessionStorage, service worker registrations and cache) after 7 days of Safari use with no user interaction on the site. Home Screen web apps "have their own counter of days of use", so an app in regular use is not wiped. [Full Third-Party Cookie Blocking and More, webkit.org, 2020-03-24](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) **[older]**
  - web.dev reconfirms that installed Home Screen PWAs are exempt. [Storage for the web, web.dev, 2024-09-23](https://web.dev/articles/storage-for-the-web)
- MDN confirms the 7-day rule applies when cross-site tracking prevention is on, and that cookies set by the server are exempt. [Storage quotas and eviction criteria, MDN, 2026-01-05](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
  - **Correction:** MDN's statement that persistent origins are skipped refers to eviction under storage pressure. Whether `persist()` also protects against Safari's 7-day deletion is **not stated** by any source checked.
- Quotas since Safari 17 / iOS 17: a browser app's origin may use up to about 60% of disk, and Home Screen web apps get the same quota. The policy covers localStorage, Cache API, IndexedDB, Service Worker and File System. WebKit grants `persist()` using heuristics such as whether the site runs as a Home Screen web app. [Updates to Storage Policy, webkit.org, 2023-08-10](https://webkit.org/blog/14403/updates-to-storage-policy/) **[older]**
  - MDN confirms these quotas. [MDN, 2026-01-05](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- `navigator.storage.persist()` is available in Safari 15.2+ and Chrome 55+. Both decide automatically, without a prompt, based on the user's history with the site. [MDN, 2026-01-05](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
  - Chrome weighs engagement, installed or bookmarked status, and notification permission, and lists "DOM Storage (Local Storage)" among the protected types. [Persistent storage, web.dev, 2020-05-12](https://web.dev/articles/persistent-storage) **[older]**
- web.dev advises avoiding localStorage because it is "synchronous and will block the main thread". It recommends IndexedDB for data and the Cache API for app files. [Storage for the web, web.dev, 2024-09-23](https://web.dev/articles/storage-for-the-web)
  - My inference: for a few KB of list data, a synchronous read at startup is the fastest route to the first screen, so localStorage stays acceptable for checkpoint 1.

---

## 3. Offline use and the "single file" promise

- A service worker script must be served over http or https; the spec rejects any other scheme. [Service Workers, W3C Editor's Draft, 2026-09-17](https://w3c.github.io/ServiceWorker/)
  - A page opened as a local file (`file://`) therefore can never register one.
- JavaScript modules loaded from a `file://` page fail with CORS errors. Module scripts are deferred automatically. [JavaScript modules, MDN, 2026-08-21](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- A service worker's default scope is its own folder. It can be broader only if the server sends a `Service-Worker-Allowed` header. [ServiceWorkerContainer.register(), MDN, 2026-06-10](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
  - GitHub Pages does not support custom headers. [Discussion #60087, GitHub Community, staff reply 2023-07-05](https://github.com/orgs/community/discussions/60087) **[older]** No later announcement was found.
  - So `sw.js` must sit at `/listolista/sw.js` and controls `/listolista/` and everything below it.
- **[new] Phones and the downloaded file.**
  - An Apple Community answer says iOS 18.5 can no longer open a local HTML file in Safari, and that Quick Look does not run JavaScript. [Apple Community thread 256102223, discussions.apple.com, 2025-07-22](https://discussions.apple.com/thread/256102223) This was not tested on iOS 26/27.
  - From the code: a shared link created on a downloaded copy uses `location.origin + location.pathname`, so it points to the local file and is useless to anyone else.
  - Conclusion: "download and open" is realistic only for **local lists on a computer**.

---

## 4. Zero-click start and the keyboard

- **iPhone.** iOS deliberately does not show the on-screen keyboard when `focus()` or `autofocus` runs without a user gesture, unless a hardware keyboard is attached. The Apple engineer: "We (Apple) like the current behavior". [WebKit bug 195884, bugs.webkit.org, reported 2019-03-18, last modified 2024-03-19](https://bugs.webkit.org/show_bug.cgi?id=195884)
  - Safari 26.x and 27 notes list no change.
- **Android.**
  - A 2023 article reports that on Android, autofocus focuses the field but a second tap is needed for the keyboard. [The problem with automatically focusing the first input, adamsilver.io, 2023-06-04](https://adamsilver.io/blog/the-problem-with-automatically-focusing-the-first-input-and-what-to-do-instead/) **[older]**
  - **Correction:** the draft's 2026 source is about the Android WebView inside a Capacitor app, not Chrome. It shows a native plugin call was needed to force the keyboard on cold launch. [QuKi-Notes PR #438, GitHub, 2026-09-25](https://github.com/ScottKirvan/QuKi-Notes/pull/438)
  - The conclusion (one tap minimum) stands, but the Chrome evidence is thinner than the draft implied.
- **`navigator.virtualKeyboard.show()`** exists only in Chromium (Chrome 94+); Safari does not have it. [BCD api/VirtualKeyboard, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data)
  - **Correction:** the draft called its user-tap requirement "undocumented". The spec says `show()` aborts if the window lacks *sticky activation*, meaning the user has not yet interacted with the page. [VirtualKeyboard API, W3C Working Draft, 2022-05-05](https://www.w3.org/TR/virtual-keyboard/) **[older]**
  - So even on Android it cannot open the keyboard on a cold start. After the first tap in the same page session it might (untested).
- A known WebKit bug: after upgrading to iOS 18, the keyboard did not appear in some installed web apps. It is still NEW, last updated 2024-12-11, with no iOS 26/27 data. [WebKit bug 279904, bugs.webkit.org, 2024-09-18](https://bugs.webkit.org/show_bug.cgi?id=279904)

---

## 5. Voice

- **Keyboard dictation needs no code.** Apple's iOS/iPadOS 27 availability page lists Spanish (Mexico) both under Dictation and under "Dictation: On-Device and Modeless Dictation", which allows typing and dictating together. [iOS feature availability, apple.com, iOS 27 page fetched 2026-09-25](https://www.apple.com/ios/feature-availability/) Gboard on Android has a mic key.
- **Web Speech API.**
  - Chrome has `SpeechRecognition` unprefixed from version 139; Safari has only `webkitSpeechRecognition` (14.1+). [BCD api/SpeechRecognition, GitHub, 2026-09-24](https://github.com/mdn/browser-compat-data)
  - By default the audio goes to a server, "so it won't work offline". [Using the Web Speech API, MDN, 2026-08-31](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
  - **Correction:** the on-device mode (`processLocally`, `available()`, `install()`) is Chrome 139 **desktop only**. The compatibility data marks it unsupported on Chrome Android, so a voice button on Android needs the internet.
- **iPhone reliability.**
  - Developers still report that iOS speech recognition silently stops after audio playback, with no error or end event, on iOS 18.7 and 26.2.
  - **Correction:** the WICG issue was *closed* on 2026-01-20 as an implementation bug. On 2026-06-30 a WebKit engineer responded, linking WebKit bug 317741 (audio session). [WICG speech-api issue #96, GitHub, opened 2021-07-18, last comment 2026-08-10](https://github.com/WICG/speech-api/issues/96)
- Chrome's speech demo lists Español – México (`es-MX`). [Web Speech API Demonstration, google.com, last modified 2024-12-19](https://www.google.com/intl/en/chrome/demos/speech.html)

---

## 6. Other device features

| Feature | iPhone | Android Chrome | Notes | Source |
|---|---|---|---|---|
| Web Share (`navigator.share`) | Safari 12.1 / iOS 12.2+ | 61+ | HTTPS and a user tap needed; cancelling gives `AbortError` | [MDN share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share); BCD 2026-09-24 |
| Clipboard `writeText` | 13.1+, inside a tap handler | 66+; gesture needed from 107 | – | BCD 2026-09-24 |
| Screen Wake Lock | Safari tab 16.4+; **installed app 18.4+** | 84+ | Released when the page is hidden, so request it again when visible | [WebKit bug 254545, fixed in iOS 18.4 (2025-03-31)](https://bugs.webkit.org/show_bug.cgi?id=254545); BCD |
| Vibration | Not supported | Yes, only after a user gesture (since Chrome 60) | The iOS "switch checkbox" haptics trick lost its script-triggered path in iOS 26.5; direct taps still tick | BCD; [haptics-web, vercel.app, undated](https://haptics-web.vercel.app/) |
| App-icon badge | 16.4+, installed apps only; shows after notification permission | Not supported | – | [Web Push for Web Apps on iOS, webkit.org, 2023-02-16](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) **[older]**; BCD |
| Background Sync / Periodic Sync | Not supported | Supported (not needed) | – | BCD |
| `storage.persist()` | 15.2+, decided automatically | 55+, decided automatically | – | BCD, MDN |

---

## 7. Background behaviour and reconnecting

- Recent developer reports: after the phone locks or the app goes to the background, sockets become "zombies". They still look open, but they are dead and no close event fires.
  - **Correction:** PhantomChat's report is about a mobile PWA in general; it does not name iOS. [phantomchat issue #162, GitHub, 2026-09-24](https://github.com/phantomyard/phantomchat/issues/162)
  - The iPad Safari evidence is the chimes-house fix, which listens for `visibilitychange`, `pageshow` and `focus`. [chimes-house PR #27, GitHub, 2026-09-24](https://github.com/Guntok90/chimes-house/pull/27)
- **[new]** That first fix was **not enough** in production. The follow-up says probing the old socket first wasted time; after at least 1 s in the background it forces a fresh connection instead. It also added `pagehide`, `online` and a watchdog. [chimes-house PR #32, GitHub, 2026-09-24](https://github.com/Guntok90/chimes-house/pull/32)
  - This answers the draft's open question "probe or always reconnect?": **always reconnect after being in the background.**
- Chrome's Page Lifecycle guidance:
  - On mobile, going "hidden" is often the last event a page can reliably observe, so save state then.
  - Close WebSockets when frozen.
  - Never rely on `unload`; use `pagehide`.

  [Page Lifecycle API, Chrome for Developers, 2023-12-01](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) **[older]**
- MQTT retained messages:
  - A new subscriber receives the retained message "immediately after they subscribe".
  - The broker keeps one retained message per topic.
  - A zero-byte retained publish deletes it.

  [MQTT Essentials Part 8, hivemq.com, 2026-02-09](https://www.hivemq.com/blog/mqtt-essentials-part-8-retained-messages/)
- **[new] Public broker.** HiveMQ says its public broker "is public and shared, so it is not intended for private or production data". [Public MQTT Broker, hivemq.com, undated page © 2026](https://www.hivemq.com/mqtt/public-mqtt-broker/)
  - Combined with guessable room codes, anyone could read, overwrite or delete a list's server copy. This is a reliability concern for the sync workstream.
- **[new] Code reading, not tested.**
  - On every (re)connect, `connectMQTT()` publishes the device's full local state as the retained message right after subscribing, **before** merging what the server holds.
  - A phone with an old copy can therefore replace the server's snapshot with a stale one. Other open phones keep their newer items, but the next person to join gets the stale snapshot.
  - The resume logic should be: subscribe, receive the retained copy, merge, then publish.

---

## 8. Performance and the current code

- About 0.1 s feels instant, and about 1 s keeps the user's flow of thought. [Response Times: The 3 Important Limits, nngroup.com, 1993, updated 2014](https://www.nngroup.com/articles/response-times-3-important-limits/) **[older, still the standard reference]**
- A service worker takes about 50 ms to start on desktop and about 250 ms on mobile (more than 500 ms in extreme cases). That matters little when answering from cache. [Navigation preload, web.dev, 2017-02-15](https://web.dev/blog/navigation-preload) **[older]**

### Baseline measured 2026-09-25 (corrected and extended)

| Item | Value | Issue | How checked |
|---|---|---|---|
| `index.html` | 100,602 B (17,535 B gzipped), 733 lines, CRLF | – | `wc`, `gzip` |
| Aisle dictionary | 69,141 B raw / 9,777 B gzipped, 1,720 pairs | Parsed on every open, even when aisle sorting is off | Python slice |
| mqtt.js from unpkg | Unpinned URL, currently 302 → `mqtt@5.16.0` (published 2026-09-16); 342,341 B / 105,204 B gzipped; loaded synchronously in `<head>` (line 183) | Blocks rendering, updates itself, breaks offline start | `curl`, npm registry |
| Offline + shared list | `init()` runs `connectMQTT()` before `render()`; the overlay is hidden only on `connect` | If the library fails to load, `mqtt` is undefined, `init()` throws, and the page stays on "Conectando..." | Code reading (not run) |
| Publish on connect | Full local state is published as retained before the merge | A stale device can overwrite the server snapshot **[new]** | Code reading |
| Presence timer | A new `setInterval` on every `connect` event | Timers pile up across reconnects | Code reading |
| Room code | `'room_' + Date.now().toString(36)` | Time-based and guessable, not random **[new]** | Code reading (line 372) |
| Share button | `confirm()` → `clipboard.writeText()` (not awaited) → navigates immediately | Whether the copy survives the `confirm()` dialog is untested | Code reading |
| Viewport | Already `maximum-scale=1.0, user-scalable=no`; main inputs 1.1rem; title 0.9rem | **Correction:** the draft implied the title causes iOS focus zoom. The viewport setting is meant to prevent that; confirm on the device. | Code reading |
| README vs code **[new]** | README promises "zero external dependencies", "No cloud servers" and download-and-open offline | Contradicted by unpkg and the HiveMQ broker | README |
| Manifest / service worker / apple-touch-icon | None | Not installable offline; iOS uses a screenshot as the icon | Code reading |

### Smaller MQTT clients (corrected)

| Library | Size (raw / gzip) | Latest release | Adoption (npm, 2026-08-25 to 09-23) | Caveat |
|---|---|---|---|---|
| mqtt.js 5.16.0 | 342,341 / 105,204 B | 2026-09-16 | about 9.26 M downloads/month | Large; fine if pinned, self-hosted, loaded after first render and cached |
| u8-mqtt 0.6.7 (`esm/web/v4.min.js`) | 15,451 / 6,142 B | 2026-01-02, BSD-2-Clause | about 950/month | **[new]** Ships as an **ES module**, so it needs converting to a classic inline script (the plan avoids modules for `file://`); low adoption; not tested against HiveMQ |
| paho-mqtt 1.1.0 | 32,236 / 8,372 B | **2018-11-22**, EPL-1.0 | about 494 k/month | **[new]** No release in about 8 years |

Sources: npm registry and jsDelivr, measured 2026-09-25; [u8-mqtt README, npm](https://www.npmjs.com/package/u8-mqtt). The draft's "hand-rolled MQTT client of about 3 KB" is an **unverified estimate**.

---

## 9. Hosting on GitHub Pages

- **Live headers, observed 2026-09-25:**
  - HTTPS with HSTS;
  - `cache-control: max-age=600` (10 minutes);
  - `last-modified: Tue, 13 Jan 2026`;
  - `content-length: 100602`, which matches the local file.
- **[new] Pages configuration:**
  - source is branch `main`, folder `/`;
  - legacy (Jekyll) build;
  - HTTPS enforced;
  - no custom domain.

  Merging to `main` publishes straight to the live app.
- **Limits:**
  - site no larger than 1 GB;
  - soft 100 GB/month bandwidth;
  - soft 10 builds per hour.

  Pages is not to be used to run an online business, e-commerce or SaaS, nor for sensitive transactions. [GitHub Pages limits, docs.github.com, undated, fetched 2026-09-25](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- **HTTPS:**
  - `github.io` sites get HTTPS automatically.
  - Custom domains get a Let's Encrypt certificate and an "Enforce HTTPS" option.

  [Securing your GitHub Pages site with HTTPS, docs.github.com, fetched 2026-09-25](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- **One origin, one storage.** An origin is scheme + host + port; the path does not matter, and "Each origin gets its own separate storage". [Same-origin policy, MDN, 2026-09-17](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
  - **[new]** Four of Victor's projects are published on the same origin, `vdm285.github.io`: ai-council-workbench, compa-precio, listolista and protobase. They share one storage area and quota, and "clear site data" clears all of them.
  - The service-worker spec notes that path scope is not a security boundary; only origins are.
- **Custom domains.** A custom domain set on a *user* site "will be used for all project sites owned by the same account". [About custom domains, docs.github.com, fetched 2026-09-25](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
  - Any move to a new domain creates a new origin, so existing installs and local lists would not carry over.
- **PR previews.** Pages has no built-in PR previews. `rossjrw/pr-preview-action` v1.8.1 (2026-01-20):
  - deploys to `/<repo>/pr-preview/pr-N/`;
  - needs Pages set to "Deploy from branch";
  - does not support PRs from forks.

  [pr-preview-action, GitHub, 2026-01-20](https://github.com/rossjrw/pr-preview-action) The previews sit inside the service worker's scope, so `sw.js` should let them pass through.

---

## Platform matrix (corrected)

| Capability | iPhone: Safari tab (iOS 26/27) | iPhone: Home Screen web app | Android Chrome (tab or installed) |
|---|---|---|---|
| Install | Manual: ⋯ → Share → Add to Home Screen → "Open as Web App" (on by default). Third-party browsers can also do it (16.4+) | – | Menu "Install"; `beforeinstallprompt` for a custom button (needs a full manifest including `start_url`) |
| Install prompt API | None; WebKit opposes Web Install | – | `beforeinstallprompt` now; `navigator.install()` is desktop-only (Chrome 156) |
| Storage shared with browser | – | **No: isolated by design, and each icon has its own storage** | Yes; repeated installs share one storage |
| Icon opens | – | Manifest `start_url` if set; otherwise the page URL (spec default) | Manifest `start_url` |
| 7-day wipe | Yes, after 7 days of Safari use without interaction | Exempt (own day counter) | No 7-day rule (evicted only under storage pressure) |
| `storage.persist()` | 15.2+, automatic | Heuristic favours Home Screen apps | 55+, automatic |
| Service worker / offline start | Yes | Yes (its own copy) | Yes |
| Keyboard on load without a tap | **No** (by design) | **No** | **No** (focus only; `virtualKeyboard.show()` needs a prior interaction) |
| Web SpeechRecognition | `webkitSpeechRecognition`, with reliability bugs | Untested | Yes, **server-based only** (on-device mode is desktop Chrome only); `es-MX` listed |
| Keyboard dictation, Mexican Spanish | Yes (on-device, modeless, iOS 27) | Yes | Gboard mic |
| Web Share | 12.2+ (tap needed) | Yes | 61+ |
| Clipboard write | Inside a tap handler | Same | Inside a tap handler (107+) |
| Screen Wake Lock | 16.4+ | **18.4+** | 84+ |
| Vibration | No | No | Yes, after a user gesture |
| App badge | – | 16.4+, shows after notification permission | No |
| Background Sync | No | No | Yes (not needed) |

## Checkpoint 1 checklist (corrected)

| # | Item | Recommended approach | iPhone gotchas | Android notes | Quick test on the real phones |
|---|---|---|---|---|---|
| 1 | Private shared link | Use long random room codes (`crypto.getRandomValues`), not timestamps. Install from the room link. Share with `navigator.share` → clipboard → `wa.me/?text=` | Isolated storage; the icon opens `start_url` | Shared with Chrome, so less fragile | Wife opens the WhatsApp link, installs, relaunches from the icon: is the same list there? Also check whether WhatsApp opened the link in Safari or in an in-app view |
| 2 | Instant sync + strike-through | Show the local copy first, connect afterwards. On return to foreground, **always** open a fresh connection, then subscribe → retained copy → merge → publish | Zombie sockets after lock; timers suspended | Same code | Lock 5 min, unlock, tap an item: does it appear on the other phone within 2 s? |
| 3 | Home-screen icon | `manifest.webmanifest` (name, short_name, `display: standalone`, `lang: es-MX`, icons 192/512 plus a separate maskable 512) and `apple-touch-icon` 180 px | apple-touch-icon takes precedence; use the `default` status-bar style | Chrome needs 192+512, `start_url` and `display` | Icon and name look right on both home screens |
| 4 | Offline | `sw.js` at `/listolista/sw.js`, cache-first app shell, versioned cache, background update; register only on `https:`; pass through `pr-preview/` and cross-origin requests | The installed app has its own service worker and cache | – | Airplane mode, launch from the icon: list opens and edits stay, then sync after reconnecting |
| 5 | Optional aisle sorting | Dictionary as an inert JSON block, parsed on the first 🏪 toggle | – | – | First toggle ≤ 50 ms (debug mark) |
| 6 | Zero-click start | Show list and input instantly; one tap anywhere focuses the input (synchronously, not after `await`); keep focus after Enter | Keyboard never opens without a tap; possible installed-app keyboard bug 279904 | Same one-tap minimum | Count taps from icon to first letter: target 1 |
| 7 | Spanish-first, voice | Keyboard dictation; split "huevos, leche y pan" on `,`, ` y ` and newlines | Dictation must be enabled in keyboard settings (not re-verified) | Gboard mic; a web voice button needs the internet | Dictate "huevos, leche y pan": three items |
| 8 | Keep screen on (opt-in) | Menu toggle; `wakeLock.request('screen')`, requested again when visible | Installed app needs iOS 18.4+ | 84+ | Screen stays on 5 min in the aisle |
| 9 | Durability | `storage.persist()` when installed; Export/Import in the menu; the broker copy is a convenience, **not a backup** | A Safari-tab-only user can lose data after 7 idle days | – | `navigator.storage.persisted()` is true in the installed app |

## Proposed hosted layout

```
/listolista/index.html            <- everything; a downloaded copy still runs local lists on a computer
/listolista/sw.js                 <- ~40 lines; scope /listolista/
/listolista/manifest.webmanifest  <- start_url strategy decided by the device test
/listolista/icon-180.png  icon-192.png  icon-512.png  icon-maskable-512.png
/listolista/vendor/mqtt-5.16.0.min.js   <- pinned, self-hosted, loaded after first render (until a smaller client is proven)
```

## Resume pattern (sketch, updated after chimes-house PR #32)

```js
let hiddenAt = 0;
function wake(){ if(!isShared) return; if(Date.now()-hiddenAt < 1000 && socketLooksHealthy()) return;
  try{ client && client.end(true) }catch(e){}; connect(); } // connect: subscribe -> await retained -> merge -> publish
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') wake(); else { hiddenAt=Date.now(); save(); } });
addEventListener('pageshow',e=>{ if(e.persisted) wake(); });
addEventListener('pagehide',()=>{ hiddenAt=Date.now(); save(); });
addEventListener('online',wake);
```

---

## Recommendation for checkpoint 1

1. **Fix the start-up path first. This is the biggest win.**
   - Render from localStorage and focus the input first; connect in the background afterwards.
   - Remove the full-screen "Conectando..." overlay and keep only the small connection dot.
   - Guard with `typeof mqtt !== 'undefined'` so the app never crashes offline.
   - Create the presence timer once.
2. **MQTT library, in two steps.**
   - (a) Now: pin mqtt.js 5.16.0, host it next to `index.html`, load it after the first render, and let the service worker cache it.
   - (b) Next: try u8-mqtt's v4 build, converted to a classic script, against the HiveMQ broker on both phones; switch if it passes.
   - This reverses the draft's order: u8-mqtt is tiny but little-used and ships as an ES module; paho has had no release since 2018.
3. **Honest single-file promise.**
   - One `index.html` holds everything, and a downloaded copy runs local lists on a computer.
   - Hosted-only helpers: `sw.js`, manifest, icons and the pinned library.
   - Register the service worker only on `https:`.
   - Update the README, which currently claims "zero external dependencies" and "No cloud servers".
4. **Service worker.** Cache-first app shell with a versioned cache and background update. Show "Nueva versión lista" in the menu and apply it on the next open. Pass through `/listolista/pr-preview/` and all cross-origin requests.
5. **iPhone isolation and start URL. Test before your wife installs (about 15 minutes, two phones).**
   - Option A: a manifest with no `start_url` or `id`, so the spec default keeps `?room=…`. Check that iOS keeps the room, and check whether Chrome still offers install (it lists `start_url` as required).
   - Option B: a per-room manifest generated in JavaScript, with an absolute `start_url`. Unverified in 2026 sources.
   - Always build the fallback: if the installed app starts with no room, open the last room it saw, and if there is none, show one big "Pegar enlace de la lista" field.
   - Recommend **one icon** for all lists, because on iOS each icon has separate storage.
6. **Install UX.**
   - Android: capture `beforeinstallprompt` and show "Instalar" in the menu, never as a banner.
   - iPhone, when not installed: a one-time, dismissible Spanish hint: ⋯ → Compartir → Agregar a pantalla de inicio → "Abrir como app web".
   - Show nothing inside the installed app.
7. **Zero-click.** Accept a one-tap minimum on both platforms. Make that tap land anywhere on the "paper" with a full-height tap target that focuses the input synchronously, and keep the same input focused after Enter.
8. **Voice.** No code for checkpoint 1: rely on keyboard dictation and split dictated text into items. A 🎤 button comes later; on Android it is online-only, and on iOS it is experimental.
9. **Sharing.** Call `navigator.share()` directly in the tap handler. On failure other than `AbortError`, fall back to `clipboard.writeText()`, then to a `wa.me` link. Wait for the share or copy to finish before navigating.
10. **Resume and reconnect.** On visible/pageshow/online after any real time in the background, **always** start a fresh connection (no probe first). Then subscribe → retained copy → merge → publish. Save on `visibilitychange` (hidden) and `pagehide`.
11. **Storage.** Keep localStorage for now. Call `navigator.storage.persist()` once when installed. Add Export/Import to the menu. Do not treat the public broker as a backup.
12. **Pay only for what is used.** Move the 69 KB dictionary into an inert `<script type="application/json">` block that is parsed only when aisle sorting is first turned on.
13. **Performance budget**, measured with `performance.now()` marks: ≤ 100 ms from icon to visible list plus focused input on repeat opens, and ≤ 1 s on a first visit over 4G.
14. **Small items.**
    - Random room codes (tiny change; overlaps with the sync workstream).
    - Wake lock as an opt-in menu toggle.
    - No vibration or haptics tricks.
    - `default` status-bar style.
    - Set html/body background colours explicitly.
15. **Hosting.**
    - Stay on `vdm285.github.io/listolista` for checkpoint 1, and keep all storage keys prefixed `listolista_` (already done).
    - Work on the branch and merge to `main` only when ready, because `main` is live.
    - Decide on any custom domain before friends and family.

---

## Corrections from verification

| Claim | Draft said | Verified finding | Status |
|---|---|---|---|
| C06 | The fetch handler is still needed for `beforeinstallprompt` | The Chrome blog says the *install prompt algorithm* still needs it; it does not address `beforeinstallprompt` | Corrected |
| C07 | `beforeinstallprompt` is non-standard | The compatibility data marks it standards-track (WICG incubation); still Chromium-only; full support Chrome 61 | Corrected |
| C09 | Last comment 2022-02-02 | The "by design" comment is dated 2022-02-01; bug last modified 2022-06-14; still NEW | Corrected (dates) |
| C10 | The icon opens `start_url` "since iOS 16.4" | iOS honouring `start_url` is confirmed (GitLab 2023, 2026 report; supported since 11.3); the 16.4 boundary is not established | Corrected |
| C14 | MDN says persistent storage is excluded from the 7-day wipe | MDN's exemption refers to storage-pressure eviction; protection against the 7-day wipe by `persist()` is not stated | Corrected |
| C25 | Android Chrome needs a native wrapper for the keyboard (2026 PR) | The PR concerns Android WebView in a Capacitor app; Chrome evidence is a 2023 blog plus the VirtualKeyboard spec | Corrected |
| C26 | `virtualKeyboard.show()` without a tap is undocumented | The spec requires sticky activation, so no cold-start keyboard | Corrected |
| C28 | On-device speech arrived in Chrome 139 | Desktop only; the compatibility data says Chrome Android does not support `processLocally`, `available()` or `install()` | Corrected |
| C29 | WICG issue still open, no WebKit response since 2021 | Closed 2026-01-20; a WebKit engineer responded 2026-06-30 (WebKit bug 317741); bugs still reported on iOS 26.2 | Corrected |
| C36 | PhantomChat shows iOS zombie sockets | PhantomChat names no platform; iPad evidence is chimes-house; follow-up PR #32 shows probe-first fails, so always reconnect | Corrected |
| C40 | u8-mqtt or Paho as drop-in small clients | Sizes confirmed; u8-mqtt is an ES module with about 950 downloads/month; paho last released 2018-11-22 | Corrected |
| Rec. 6 | Title at 0.9rem triggers iOS auto-zoom | The page already sets `maximum-scale=1.0, user-scalable=no`; main inputs are 17.6 px; confirm on the device | Corrected |
| Extra, row 1 | "Keep `?room=<long random id>`" | Current codes are `room_` + base-36 timestamp: guessable | Corrected |

**Confirmed without change:** C01–C05, C08, C11–C13, C15–C24, C27, C30–C35, C37–C39, C41–C45. Where a sub-point rests on an older source, it is marked above.

---

## Open questions / for Victor

**Decisions for you**
1. **Test session.** Can we borrow your wife's iPhone (which iOS version?) and one Android phone for about 20 minutes? That settles the room link in the installed app, the one-tap keyboard, dictation, and lock/unlock sync.
2. **"Download and open" promise.** It works only for local lists on a computer; iPhone cannot run a downloaded HTML file. Keep it as a desktop-only feature, or drop it from the README?
3. **Public message server.** HiveMQ's free broker is meant for testing only, and room codes are guessable. Is that acceptable until the friends-and-family stage, or should the sync workstream pick a hosted broker earlier?
4. **Custom domain.** Stay on `vdm285.github.io` permanently, or pick a domain before friends and family? Changing later resets installs and local lists.
5. **Donate button.** GitHub Pages bans online-business, e-commerce and SaaS use. Whether a simple donate link is allowed was not checked. Check before going public.

**Technical questions for the device test**
6. When the manifest omits `start_url`, do iOS 26/27 and Chrome Android keep `?room=…` in the installed app, and does Chrome still offer install?
7. Does a manifest generated in JavaScript (data: or blob: URL with an absolute `start_url`) install correctly on iOS 26/27 and Chrome Android? No 2026 source was found.
8. Does WhatsApp open the link in Safari/Chrome, or in an in-app view where "Add to Home Screen" is missing?
9. On the share button: does `clipboard.writeText()` still succeed after a `confirm()` dialog in the same tap?
10. Does `webkitSpeechRecognition` work inside an iOS 26/27 Home Screen app with `es-MX`?
11. Is `wss://broker.hivemq.com:8884` reachable on Mexican mobile carriers and store Wi-Fi? (Port 8884 is not 443.)
12. Is WebKit bug 279904 (keyboard not appearing in installed apps) reproducible on iOS 26/27?
13. After a first tap, can `navigator.virtualKeyboard.show()` raise the keyboard on Android when the app resumes? (Per the spec it may; untested.)
14. Does `persist()` protect a Safari-tab user from the 7-day wipe? No source says so.
