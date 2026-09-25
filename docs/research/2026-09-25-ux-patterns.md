# ListoLista UX: minimalist capture and shared-list patterns (verified 2026-09-25)

- **Date:** 2026-09-25
- **Repo / branch / commit read:** `listolista`, `design/checkpoint-1`, HEAD `2e5bc85`
- **Status:** a draft was fact-checked: all 23 high-relevance claims and 17 others were re-opened at the source. Unverified points are marked **(unverified)**.
- **Status legend:** ✅ confirmed · ✏️ corrected · ❌ refuted · ❓ unverified
- **Not used:** Reddit and X (per instructions); memory of past reading.

---

## Bottom line

- **Show the list first; hide the rare stuff in one labelled menu.** NN/g and Apple both say it: a few key options up front, at most two levels, gestures only as shortcuts. Today the app has 6 unlabelled emoji buttons in the header. The "delete everything" button sits right next to the others.
- **The biggest bug for the supermarket:** a shared list covers the screen with "Conectando..." until the internet connects. With no signal, the list never appears. If the MQTT script itself can't load, the list is never even drawn. Fix this first.
- **Replace pop-up confirmations with Undo.** The code already keeps deleted items as hidden "tombstones", so Undo is cheap to build.
- **Zero-click is only partly possible on iPhone.** iOS won't open the keyboard by itself. The list can appear instantly, but typing needs one tap. So the whole empty area should be a "tap here to write" zone. Android behaviour still needs a test on your wife's phone.
- **The home-screen icon matters.** Since iOS 26, any site added to the Home Screen opens as an app. Home-screen apps are also exempt from Safari's 7-day data wipe. One catch: the home-screen app does **not** share saved data with Safari, so the shared-list link must be what gets added.
- **Android is two-thirds of Mexico** (Aug 2026). On Android Chrome the current "no zoom" setting really blocks zooming; iPhone ignores it. Swiping in from the right edge on Android means "Back", so row swipes need care.
- **Competitors' users complain about** ads over the list, sync failures between spouses, account/verification nags and feature clutter. They praise simplicity and easy sharing with a partner.
- **Correction to the draft:** "no account" is not unique. OurGroceries and Listonic let the *recipient* open a link without an account. What stands out for ListoLista is **no account for anyone, no ads, opens straight to the list**.
- **Paper vs rows:** build "paper" as a Notes-style hybrid: one line = one item with its own ID, plus a separate tap target to strike. Don't build a single text box that syncs as one blob.
- **Voice: use the keyboard's microphone**, not a custom mic button. iPhone dictation in Spanish (Mexico) works on-device. The web speech API is not available in iPhone home-screen web apps.

---

## 1. What the current code does (read 2026-09-25, HEAD 2e5bc85)

| Area | What the code does | Why it matters | Status |
|---|---|---|---|
| Shared-list start | `index.html` l.286 shows a full-screen overlay (fixed, z-index 200, 95% white) when `isShared`. It is hidden only inside `client.on('connect')` (l.523). No offline path. | Offline in the store, the list never appears. | ✅ |
| MQTT load failure | `connectMQTT()` runs *before* `render()` in `init()` (l.285-292). If `mqtt` failed to load (offline, CDN down), `mqtt.connect` throws, so `render()` and `focus()` never run. | Even worse than a spinner: nothing is drawn. | New finding |
| Header | 6 emoji `<div>`s: ☑️ clear-struck, 🚮 wipe (red), 🔤 A-Z, 🏪 aisle, 📚 library, 🔗 share. They have `title=` tooltips only (invisible on touch). Font 1.2rem with no padding, so the tap area is about 20 px. | Unlabelled, below 44 pt, destructive next to routine. | ✅ |
| Rows | Rows are at least 55 px tall. The whole row toggles strike. A "×" at the right end deletes instantly, with no undo. | Good strike target. Accidental delete sits right next to the strike area. | New finding |
| Delete model | Delete and wipe set `deleted=true` plus a timestamp (tombstone), not a hard delete (l.506-516, 426-441). | Undo = clear the flag with a new timestamp. Cheap. | New finding |
| Dialogs | `confirm()` for "¿Borrar todo?" and "¿Convertir esta lista en compartida?"; `alert()` after sharing (l.371-378, 426). | Conflicts with undo-first. | ✅ |
| Zoom | l.5: `maximum-scale=1.0, user-scalable=no`. Inputs are 1.1rem (about 17.6 px), so iOS input auto-zoom would not trigger anyway. | Blocks zoom on Android Chrome. | ✅ ✏️ (see §6.5) |
| Done state | Only `.done .txt { text-decoration: line-through }` on a `div`. No `role`/`aria-*` anywhere. | Screen readers can't tell done from not done. | ✅ |
| Dark mode, manifest, service worker | None found (grep for `prefers-color-scheme`, `manifest`, `serviceWorker`). | No install polish, no offline shell. | ✅ |
| Dictionary | `SUPERMARKET_DICT` = 69,149 bytes of a 100,602-byte file (about 69%), 1,720 entries. | Loaded on every open even if aisle sorting is off. | ✅ |
| MQTT library | l.183: `<script src="https://unpkg.com/mqtt/dist/mqtt.min.js">` in `<head>`, unpinned. It redirects to `mqtt@5.16.0`: 342,341 bytes (about 105 KB gzipped). It is render-blocking and loads even for local lists. | Slow first paint; unpinned third-party code. | ✅ |
| Presence | Publishes a presence ping every 5 s after connect (l.528). | Battery/data cost in the store (sync track). | ✅ |
| Docs drift | `README.txt` still says "No cloud servers", zero external dependencies, two input slots, JSON save/open. | Misleading for future agents. | ✅ |

---

## 2. Principles and what they mean for ListoLista

| Principle | Verified source | What to do |
|---|---|---|
| Progressive disclosure | NN/g says: "show users only a few of the most important options" and more than 2 levels "typically have low usability" ([Progressive Disclosure, NN/g, 2006-12-03](https://www.nngroup.com/articles/progressive-disclosure/)) | Level 1: list, write line, Compartir. Level 2: one ⋯ sheet. No level 3. |
| Visible labels | NN/g: labels "should be visible at all times"; only home, print and search icons are near-universal ([Icon Usability, NN/g, 2014-07-27](https://www.nngroup.com/articles/icon-usability/)) | Write "Compartir" as a word. The ⋯ sheet shows icon + text. |
| Hidden menus are used less | 179 users, 6 sites: e.g. 89% used visible/combo navigation vs 44% hidden ([Pernice & Budiu, NN/g, 2016-07-24](https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/)) | Keep primary actions visible. Put only rare actions in one salient, labelled menu. |
| Gestures are accelerators | NN/g: users expect swipe to reveal Delete; keep swipe meaning consistent ([Contextual Swipe, NN/g, 2017-02-12](https://www.nngroup.com/articles/contextual-swipe/)). Swipe actions "should also be present in the visible UI" ([Contextual Menus, NN/g, 2019-03-17](https://www.nngroup.com/articles/contextual-menus/)). Apple: a custom gesture must be "Not the only way to perform an important action", and should avoid system-UI gestures ([HIG Gestures, Apple, change log 2024-09-09](https://developer.apple.com/design/human-interface-guidelines/gestures)) | Every gesture needs a visible alternative. No swipes starting at screen edges (see §6.6). |
| Undo over confirm | Nielsen: overuse makes people "stop paying attention"; "go to great lengths to provide undo". Keep confirmations for serious, irreversible actions ([Confirmation Dialogs, NN/g, 2018-02-18, reviewed 2026-08-07](https://www.nngroup.com/articles/confirmation-dialog/)) | Snackbar "Deshacer"; no `confirm()`. |
| Empty states | "Totally empty states cause confusion"; give status, in-context tips and a direct path to the key task ([Kaplan, NN/g, 2021-09-19](https://www.nngroup.com/articles/empty-state-interface-design/)) | First open: title, write line with example placeholder, one hint. |
| Recognition over recall | Show recent items and suggestions; contextual tips beat tutorials ([Budiu, NN/g, 2024-01-15](https://www.nngroup.com/articles/recognition-and-recall/)) | Keep struck items visible as memory; later, autocomplete from history. |
| Hick's law / choice overload | Fewer choices when time matters; don't "simplify to the point of abstraction" ([Hick's Law, Laws of UX, undated](https://lawsofux.com/hicks-law/)). Meta-analysis (99 observations, N=7,202): overload grows with task difficulty, set complexity, preference uncertainty and an effort-minimizing goal ([Chernev et al., J. Consumer Psychology, online 2014-08-29](https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf)) | The in-store view has one job: tap to strike. (Applying a product-assortment study to UI menus is our analogy, not the paper's claim.) |
| Reach and edges | Bottom sheets don't really improve reach; the middle of the screen is easiest ([Laubheimer, NN/g, 2023-06-11](https://www.nngroup.com/articles/bottom-sheet/)). On touch, edge targets take longer ([Budiu, NN/g, 2022-07-31](https://www.nngroup.com/articles/fitts-law/)). Hoober: about 11 mm at the top, 7 mm in the centre, 12 mm at the bottom ([Smashing Magazine, 2023-04](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)); 49% of 1,333 people used one thumb ([UXmatters, 2013-02](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php)). A 2026 preprint (not peer reviewed) found more hits when the target touches the edge ([Kasahara et al., arXiv, 2026-03-25](https://arxiv.org/abs/2603.23865)) | Frequent action (strike) = full-width rows mid-screen. Top icons get big hit areas that reach the edge. |
| Touch-target minimums | Apple: "hit region of at least 44x44 pt" ([HIG Buttons, change log 2025-12-16](https://developer.apple.com/design/human-interface-guidelines/buttons)); iOS table default 44x44, minimum 28x28 ([HIG Accessibility, 2025-06-09](https://developer.apple.com/design/human-interface-guidelines/accessibility)). Google: 48x48 dp (about 9 mm), 8 dp spacing ([Android Accessibility Help, undated](https://support.google.com/accessibility/android/answer/7101858?hl=en)). WCAG 2.2 AA: 24x24 CSS px or spacing ([W3C, SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) | Aim for 44-48 px targets with 8 px gaps. |
| Follow system dark mode | "Avoid offering an app-specific appearance setting" ([HIG Dark Mode, change log 2024-08-06](https://developer.apple.com/design/human-interface-guidelines/dark-mode)) | `prefers-color-scheme`, no toggle. |
| Clean, predictable UI | NN/g faults iOS 26 Liquid Glass for legibility, cramped targets and controls that appear and disappear ([Budiu, NN/g, 2025-10-10](https://www.nngroup.com/articles/liquid-glass/)). Google: key elements spotted "up to four times faster" with M3 Expressive; 46 studies, 18,000+ people ([Google Design, date not shown, ~May 2025](https://design.google/library/expressive-material-design-google-research)) | High contrast, stable layout, the main action made obvious through size. |

---

## 3. Where secondary actions can live

| Placement | Discoverability | Clutter | Evidence | Verdict |
|---|---|---|---|---|
| Row of top-bar icons (now: 6 emoji) | Medium; unlabelled icons are ambiguous | High | NN/g icons 2014 | Keep at most 2: "Compartir" and ⋯ |
| One ⋯ menu | Lower (hidden) | Minimal | NN/g hidden nav 2016 | Good for rare actions if labelled and salient |
| Bottom sheet from ⋯ | OK once open | Minimal | NN/g 2023: visible Close, support Back, don't stack | Use for ⋯ and the list switcher |
| Long-press on item | Low | None | HIG: touch and hold = "Reveal additional controls or functionality" | Edit an item. Show a one-time hint. |
| Swipe on item | Low; people expect Delete | None | NN/g 2017; Android edge-back (§6.6) | Optional shortcut for delete + Undo; start zone away from edges |
| Tap on title | Medium (add ▾) | None | Common pattern **(unverified as a study)** | Switch/create lists (replaces 📚) |

---

## 4. Competitors

### 4.1 How they work

| App | Add | Complete | Sharing / account (verified) | Notes |
|---|---|---|---|---|
| Apple Notes checklist | Text editor; "Each time you tap return, a new item is added" | Tap the circle | Apple account | Checked items can auto-sort down; drag; swipe to indent ([Apple Support, 2025-02-11](https://support.apple.com/en-us/102296)) |
| Apple Reminders "Groceries" | Rows | Tap the circle | iCloud; Apple devices only; iOS 17+ | Auto-sorts into sections and remembers your corrections ([Apple Support, 2025-12-11](https://support.apple.com/en-us/105086)). **Spanish (Mexico) is supported** ([iOS feature availability, Apple, fetched 2026-09-25](https://www.apple.com/ios/feature-availability/)). A real free competitor on your iPhone. |
| Google Keep list | Rows, or a note with checkboxes | Checkbox | Google account | A 2026 review: in a checkbox note "everything has to have a checkbox" (no headings) |
| Bring! | Tile grid, search | Tap tile | Invite must go to "the same email address" the person uses with Bring! ([Bring! help, undated](https://www.getbring.com/help-center-main-categories/items-lists)) | 4.81 from 9.8k US ratings |
| AnyList | Rows | Tap | Email invite; invitee registers with the same email ([AnyList help, undated](https://help.anylist.com/articles/share-list/)) | English and German only (iTunes metadata, 2026-09-25) |
| OurGroceries | Rows | Tap: item moves to the bottom; tap again to bring it back | Household = one shared email account. **Also per-list links: recipients "won't need to install" the app or create an account** and can see and add items; the sharer needs an account ([OurGroceries user guide, undated, ©2009-2026](https://www.ourgroceries.com/user-guide)) | Its strike behaviour matches our "Tachados" proposal |
| Listonic | Rows | Tap | Link: "anyone with the link" can see and edit if allowed. **Sources conflict** on whether the *sharer* needs an account: the help center says sharing "requires signing in" ([Listonic help, modified 2023-05-22](https://helpcenter.listonic.com/how-to-share-a-list/)), while the vendor comparison says basic sharing needs none ([Listonic, updated 2025-03-28](https://listonic.com/compare-apps/listonic-vs-our-groceries)) | AI assistant; ad complaints in 2026 |
| Grocery (Conrad Stoll) | Rows + "custom auto-complete with your list items" | Tap | Via Reminders/iCloud (Apple only) | "Keeps track of the order you mark off items to sort your list next time"; supports multiple stores; English only; 4.51 from 4,732 ratings; v. 2026-07-19 ([App Store](https://apps.apple.com/us/app/grocery-smart-shopping-list/id1195676848)) |
| Drafts | Opens to a "new, ready-to-edit draft" | n/a | n/a | "New Draft After" timeout from 30 s to 1 h, or Never; pin to keep one draft ([Drafts docs, undated](https://docs.getdrafts.com/docs/editor/new-drafts-and-pinning)). Zero-click precedent. |
| Things 3, Todoist | (from draft) | | | **(unverified in this pass)** |

**App Store ratings** (iTunes lookup, US, 2026-09-25): OurGroceries 4.82 (84.7k) · AnyList 4.87 (80.6k) · Bring! 4.81 (9.8k) · Listonic 4.70 (10.2k) · Google Keep 4.59 (29.0k) · Grocery 4.51 (4.7k).

### 4.2 What users complain about (App Store feeds, 100 most recent US reviews per app, fetched 2026-09-25)

| App | Review window | Low-rated (≤3) | Main complaints (dated examples) |
|---|---|---|---|
| Listonic | all 2026 | 13 | Ads "block out almost entire list" (05-21); ads "out of hand" (05-25); "worthless AI assistant" (05-26); sync with wife broke (08-10); background alerts (08-17); privacy pop-up resets (03-30); advertiser items added to the list (03-15); "Just make it open the list when we open the app" (09-06, title "Less is more") |
| OurGroceries | all 2026 | 14 | Larger motion ads (08-30); wife tapped an ad and a loud message played mid-store (08-24); review badgering interrupted an action (05-14); couldn't share with husband (05-17); iOS 26 crashes; extra steps after a redesign |
| AnyList | all 2026 | 8 | A list entered on the partner's phone hadn't synced hours later (08-22); lock-screen widget removed (08-31); Apple Watch broke (09-16); Alexa integration gone |
| Bring! | **2023-07 to 2026-09 (only 24 from 2026)** | 19 | 2026: drops items / sharing (01-05, 01-27), can't edit categories (03-21), badge nag (05-28). Watch removal, camera permission, email-verify bug and "$24.9x/yr" are **2023-2025** reviews. Mexico store 2026-08-15: verification nag keeps coming back; dislikes notifications. |
| Google Keep (iOS) | all 2026 | 81 | Mostly crashes/not opening. 2026-07-06: switched from Apple Notes because a shared note "wouldn't update". |

Other dated voices (Hacker News): a year of arguments over grocery items that never synced in Notes ([HN, 2026-01-23](https://news.ycombinator.com/item?id=46729800)); still correcting Reminders for putting wood glue in Candy ([HN, 2026-07-11](https://news.ycombinator.com/item?id=48875587)); about a third of a couple's nightly grocery list gets autocorrected wrongly ([HN, 2026-03-08](https://news.ycombinator.com/item?id=47298043)).

**Praise.** A crude keyword count over 4-5 star reviews found "easy/simple" in about 29-38% and "share/spouse/family/sync" in about 32-44%. The draft got 25-37% and 29-41% with a different regex. Trust the direction, not the digits.

**Takeaway.** A list that opens straight to the list, syncs reliably, needs no account for anyone, and has no ads or nagging is the gap these reviews describe.

---

## 5. Paper vs rows

| Criterion | Raw paper (one textarea) | Paper-hybrid (Notes-style lines) | Rows |
|---|---|---|---|
| Adding many items fast | Best | Best | Good (input keeps focus after Enter) |
| Notepad feel | Best | Very good | Medium |
| Tap to strike | Clashes with placing the cursor | Separate margin circle (like Notes) | Whole row: biggest target |
| Keyboard popping up in the store | Often | Only when tapping text | Only when tapping the input |
| Accidental edits | High | Medium | Low |
| Concurrent edits | Whole-text last-write-wins loses edits | Per-line IDs keep today's per-item sync | Per-item (today's code) |
| Screen readers | Poor | OK with checkbox semantics per line | Good |
| Who does it | todo.txt: "A single line ... represents a single task" ([GitHub, pushed 2026-06-28](https://github.com/todotxt/todo.txt)) | Apple Notes | Reminders, Keep lists, Bring!, AnyList, OurGroceries, Listonic |

**Why whole-text sync loses data.** When whole objects are written with last-write-wins, "Alice's move is silently erased"; "per-field patches let unrelated edits merge". Collaborative text needs OT (Google Docs) or sequence CRDTs (Yjs, Zed) ([Tyler Crosse, 2026-07-08](https://www.tylercrosse.com/ideas/2026/real-time-collaboration-contention/)). Notion's old last-write-wins lost one person's edits "completely"; it moved to an RGA CRDT in production in July 2025 ([Notion blog, 2026-09-18](https://www.notion.com/blog/how-notion-handles-concurrent-editing-with-crdts)).

**Verdict:** test the paper-hybrid against rows. Do not ship a raw textarea with sync.

---

## 6. Platform facts that shape checkpoint 1

### 6.1 iPhone keyboard (zero-click limit) ✅
- **Keyboard:** iOS does not show the keyboard for programmatic focus or `autofocus`. [WebKit bug 195884](https://bugs.webkit.org/show_bug.cgi?id=195884) is still NEW (opened 2019-03-18, last modified 2024-03-19). A WebKit engineer called auto-showing it potentially "annoying and a distraction". iOS 16 relaxed this only for native apps that embed web views.
- **No change since:** the release notes for [Safari 27.0 (WebKit, 2026-09-17)](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) list no change to this.
- **Android:** unverified. Chrome has a VirtualKeyboard API, but whether the keyboard opens on load has to be tested on the actual phone.

### 6.2 Home Screen ✅
- **Opens as an app:** since iOS 26, every site added to the Home Screen opens as a web app by default, with no manifest needed ([WebKit, Safari 26.0, 2025-09-15](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [heise, 2025-10-10](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html)). A manifest still adds name, icon and colours.
- **Protected from the 7-day wipe:** Safari deletes script-writable storage "after 7 days of no user interaction", and home-screen web apps are exempt ([WebKit Tracking Prevention, undated](https://webkit.org/tracking-prevention/)).
- **New finding, separate storage:** home-screen apps do not share storage with Safari. Apple says this is "by design" ([WebKit bug 181849, last modified 2022-06-14](https://bugs.webkit.org/show_bug.cgi?id=181849)). Lists saved in Safari won't appear in the icon version. The shared list only comes back if the added URL carries `?room=` (the broker keeps the latest state as a retained message, l.577).
- **`start_url` is only a hint:** browsers "may not always use the specified value" ([MDN, modified 2026-08-31](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)). A fixed `start_url` could therefore drop the room. Test this.
- **Android install:** Chrome's install criteria are a manifest with name, 192 and 512 px icons, `start_url` and `display`, plus some user engagement. The list does not mention a service worker ([web.dev, updated 2024-09-19](https://web.dev/articles/install-criteria)).

### 6.3 Android market share in Mexico ✅
- In Mexico, Android had 66.03% and iOS 33.96% of mobile use in August 2026 ([StatCounter](https://gs.statcounter.com/os-market-share/mobile/mexico)).

### 6.4 Voice ✅ (strengthened)
- **Keyboard mic:** iPhone dictation works "anywhere you can type", keeps the keyboard open, and runs on-device in many languages ([Apple iPhone User Guide, undated](https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/ios)). **Spanish (Mexico) is on Apple's on-device dictation list** ([iOS feature availability](https://www.apple.com/ios/feature-availability/)).
- **Web Speech API:** in Chrome, audio goes to a server and "won't work offline" ([MDN, modified 2026-08-19](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)). It is not Baseline.
- **Not in home-screen apps:** caniuse notes Safari's prefixed version is not available in web apps added to the Home Screen ([caniuse data, updated 2026-09-23](https://caniuse.com/speech-recognition)).

### 6.5 Zoom and text size ✏️
- **Lighthouse:** fails `user-scalable=no` or `maximum-scale` below 5 ([Unlighthouse, 2025-01-18](https://unlighthouse.dev/learn-lighthouse/accessibility/meta-viewport)).
- **iPhone:** Safari has ignored `user-scalable`, `min-scale` and `max-scale` since iOS 10 ([WebKit, 2017-02-02](https://webkit.org/blog/7367/new-interaction-behaviors-in-ios-10/)).
- **Android:** Chrome, Firefox and Edge on Android obey it unless the user finds "Force enable zoom" ([QuirksBlog, 2020-12-15](https://www.quirksmode.org/blog/archives/2020/12/userscalableno.html)). The harm therefore lands on the Android majority.
- **Input auto-zoom:** iOS zooms into inputs below 16 px ([CSS-Tricks, 2021-05-04](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)). Our inputs are about 17.6 px, so the zoom block is not needed.

### 6.6 Gestures near edges (new)
- **Android:** with gesture navigation, Back is an inward swipe "from either the left or the right edge" ([Android Developers, updated 2026-09-16](https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav)). Web pages cannot opt out.
- **iPhone:** Safari's back swipe comes from the left edge.
- **What to do:** a row swipe-left that starts near the right edge would trigger Back on Android. Make tap and long-press the main paths, and treat swipes as optional.

### 6.7 Autocorrect ✅
- The `autocorrect` attribute became Baseline "newly available" on 2026-09-11 (Chrome 153; Safari has had it since iOS 14.5) ([web-features data](https://github.com/web-platform-dx/web-features); [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect)).
- Use it only if your wife's real typing shows the problem.

### 6.8 Haptics ✏️
- **Android:** `navigator.vibrate` works on Chrome for Android.
- **iPhone:** no iOS Safari version supports it, 27.x included (caniuse).
- **The iOS switch trick:** Safari 18 plays a haptic tap on switch controls ([WebKit, 2024-09-16](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)). A library page says Apple's iOS 26.5 "closed the programmatic path" libraries used ([haptics-web, undated](https://haptics-web.vercel.app/)). Treat the trick as fragile.
- **Apple's advice:** use haptics consistently and alongside other feedback ([HIG Playing haptics, 2024-05-07](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)).

### 6.9 Screen readers ✅
- `<s>` is "never announced as 'struck through'" by major screen readers (NVDA 2024.4.2, VoiceOver, Narrator) ([Manuel Sánchez, 2025-04-18](https://manuelsanchezdev.com/blog/accessible-del-ins-s-screen-readers/)).
- A CSS line-through on a div carries no meaning either. Items need checkbox semantics.

### 6.10 Undo snackbar timing (new)
- **Timing:** Material's web snackbar accepts auto-dismiss times of 4,000-10,000 ms (default 5 s) and announces its text politely to screen readers ([material-components-web README, repo archived, last push 2025-01-13](https://github.com/material-components/material-components-web/tree/master/packages/mdc-snackbar)).
- **Proposal:** keep Undo visible for about 8 s or until the next action.

### 6.11 WhatsApp link preview (new)
- **Tags:** WhatsApp previews use `og:title`, `og:description`, `og:url` and `og:image`.
- **Image rules:** under 600 KB, at least 300 px wide, aspect ratio 4:1 or less.
- **Placement:** tags must be in `<head>` within the first 300 KB of HTML ([Meta for Developers, undated](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews)).
- **Why it matters:** a shared link that shows "ListoLista · Lista del súper" and an icon looks trustworthy to your wife.

### 6.12 Spanish microcopy ✅
- **Tone:** Microsoft's es-MX guide says "clear, friendly and concise", conversational, and uses "tú".
- **Capitalization:** in UI labels, capitalize only the first word.
- **Errors:** no need to carry over exclamation marks. Prefer impersonal forms over repeating "tú" ([Microsoft es-MX Style Guide PDF, modified 2024-09-05](https://download.microsoft.com/download/9/0/1/9016efc5-6455-4a9d-ae78-ed3df93b2851/spa-mex-StyleGuide.pdf)).

### 6.13 Testing method ✅
- **Prototypes:** with static screens, users gave "less specific feedback"; interactive prototypes surfaced specific problems ([Megan Chan, NN/g, 2026-09-11](https://www.nngroup.com/articles/test-earlier-with-ai/)).
- **Dogfooding:** "you cannot reliably simulate not knowing" ([Therese Fessenden, NN/g, 2026-08-07](https://www.nngroup.com/articles/dogfooding/)). The Victor + wife test is dogfooding. It is useful, but it is not user research.

---

## Recommendation for checkpoint 1

### A. Fix first (blocking)
1. **Never block the list.** Render from localStorage first, then connect. Remove the full-screen overlay. When offline, show a slim bar: "Sin conexión. Tus cambios se envían al volver." Wrap `mqtt.connect` so a failed script load can't stop rendering.
2. **Undo instead of dialogs.** Delete, clear-struck and wipe set tombstones (already the model). The snackbar "Se borró «leche» · Deshacer" un-tombstones. Sharing opens the native share sheet directly (`navigator.share`; fallback: copy link + "Enlace copiado").
3. **Zoom on.** Remove `maximum-scale=1.0, user-scalable=no`. Keep inputs at 16 px or more.

### B. Layout
4. **Header = three things:** list title with ▾ (switch/create lists), a labelled "Compartir" button with a status dot, and one ⋯ button. Hit areas at least 44 px, reaching the top edge.
5. **⋯ bottom sheet** (visible Close, closes on Back): Agrupar por pasillo (switch) · Limpiar tachados · Vaciar lista · Acerca de. Drop A-Z for now.
6. **Rows (mock-up B):** whole row = strike. Remove the always-visible "×" (accidental-delete risk next to the strike area). Long-press opens a small menu (Editar, Borrar), which matches the HIG meaning of touch-and-hold. Swipe-to-delete is optional, and never from the edges.
7. **Struck items:** a collapsible "Tachados (n)" section at the bottom with "Limpiar". Tapping a struck item brings it back, as OurGroceries does.
8. **Accessibility basics:** real `<button>`s with Spanish `aria-label`s; items as `role="checkbox"` + `aria-checked` (or native checkboxes); contrast at least 4.5:1; `prefers-color-scheme` dark mode, no toggle; honour `prefers-reduced-motion`.

### C. Zero-click, honestly
9. **The first frame shows the list plus an active write line.** On iPhone the keyboard needs one tap, so the whole empty area below the list is a tap-to-write zone. Keep the `focus()` call; it helps on desktop and maybe Android (test).

### D. Pay for what you use
10. **Split the dictionary out:** move `SUPERMARKET_DICT` into `aisles-es-mx.json`. Fetch it only when "Agrupar por pasillo" is first switched on.
11. **Load MQTT only for shared lists:** after first paint, `async`, pinned version (e.g. `mqtt@5.16.0`), and cached by a service worker so shared lists open offline.

### E. Home screen and sharing
12. **Manifest:** name "ListoLista", `short_name`, 192/512 icons, `display: standalone`, theme colours; plus `apple-touch-icon` and Open Graph tags for WhatsApp.
13. **Install hint:** show it once and let people dismiss it. Show it after sharing or on the second visit, **while on the shared-list URL**, because the home-screen copy doesn't see Safari's storage. Text: "Ponla en tu pantalla de inicio: abre al instante y funciona sin internet."

### F. Input details
14. **Splitting and pasting:** split typed/dictated input on commas. Optionally split on " y ", but test it first ("pan dulce, integral" shows the risk). A multi-line paste creates many items.
15. **Voice:** no custom mic button. Rely on the keyboard mic.
16. **Autocorrect:** set `autocorrect="off"` only if real use shows mangled items.
17. **Haptics:** skip on iPhone. If you want it at all, use one short vibrate on strike, on Android only.

### G. Microcopy (tú, sentence case, short)

| Place | Text |
|---|---|
| Default title | Mi lista |
| Write line | Escribe algo… (ej. huevos, leche) |
| Share button | Compartir |
| Share message | Nuestra lista del súper: <enlace> |
| Undo | Se borró «leche» · Deshacer |
| Clear struck | Se limpiaron 5 tachados · Deshacer |
| Offline | Sin conexión. Tus cambios se envían al volver. |
| Menu | Agrupar por pasillo · Limpiar tachados · Vaciar lista · Acerca de |
| Hints | Toca un artículo para tacharlo. / Mantén presionado para editar. |
| Error | No se pudo conectar. Tu lista sigue guardada aquí. |

### H. The two mock-ups (both clickable, same 10 sample items, 2 struck)
- **A "Papel":** one ruled sheet. Enter = new line = new item. A left margin ○ strikes (48 px column). Tapping text places the cursor. Struck lines stay in place. Under the hood: one element per line, each with its own ID.
- **B "Renglones":** one input pinned at the top that keeps focus after Enter. Full-width rows at least 56 px tall; tap to strike; struck rows move to "Tachados". Long-press opens the Editar/Borrar menu.

**Test script** (same for both, both phones, about 10-15 min each):
1. Open from the home-screen icon and add "huevos, leche, pan".
2. In the store, one person strikes 2 items while the other watches them update.
3. Both add an item at the same moment.
4. Fix a typo.
5. Delete by accident, then undo.
6. Airplane mode: strike 2 items, then reconnect.

Record for each run: taps and seconds to the first item, mis-taps, surprise keyboard pops, and what each person wished for.

**Before calling it done:** watch 3-5 friends or family open the link cold, with no explanation.

### I. Housekeeping
18. **README:** update `README.txt`. It still describes the old local-only version.

---

## Corrections from verification

| ID | Draft said | Verified | Status |
|---|---|---|---|
| C19 | Most apps require an account to share; Listonic needs none | OurGroceries per-list links need no account or app for the recipient. Listonic link recipients need none either, but Listonic's own help center says the *sharer* must sign in (vendor pages conflict). The accurate differentiator: **no account for anyone**. | ✏️ |
| C18 / review table | 100 recent reviews per app, "dates mostly 2026" | True for Listonic, OurGroceries, AnyList and Keep. **Bring! US spans 2023-07 to 2026-09 (24 of 100 from 2026).** Watch removal, camera, email-verify and the $25/yr complaints are 2023-2025. Keyword shares re-measured at about 29-38% / 32-44%. | ✏️ |
| C30 | Disabling zoom is an accessibility failure | Confirmed. The practical harm is on **Android** (Chrome, Firefox and Edge obey it); iOS Safari has ignored it since iOS 10. | ✏️ |
| C29 | iOS 18 switch haptic, used by a 2026 library | Confirmed for Safari 18. A library page (undated) says **iOS 26.5 closed the programmatic path**. The hack is fragile. | ✏️ |
| C21 | Grocery keeps a separate order per store | The description lists multiple stores and learned sort order. "Separate order per store" is not stated verbatim. English only; sharing via iCloud Reminders. | ✏️ |
| C28 | Keyboard dictation is on-device for many languages | Strengthened: **Spanish (Mexico)** is on Apple's on-device list. caniuse: web speech is **not available in home-screen web apps**. | ✅ (+) |
| C39 | Overlay blocks the list offline | Confirmed. Also, if the MQTT script fails to load, `render()` never runs. | ✅ (+) |
| C40 | Dictionary 69,139 of 99,869 bytes | Measured 69,149 of 100,602 bytes (about 69%), 1,720 entries. MQTT: 342,341 bytes, about 105 KB gzipped. | ✅ (minor) |
| C09 | Hoober: grips switch every few seconds | 49% one-thumb (1,333 people, 2013) confirmed. "Switch every few seconds" not re-verified. | ❓ (detail) |
| C38 | Google research article 2025-05-13 | Content confirmed; the page shows no date. | ✅ (date unverified) |
| Extra §3 | Things 3, Todoist rows; OurGroceries "$6/yr" (Homsy); Bring! "$25/yr" | Not re-verified. Bring! price comes from a 2024 review. | ❓ |
| Extra §2 | Swipes: avoid left edge (Safari) | Also avoid the **right** edge: Android gesture Back works from both sides. | ✏️ |

No draft claim was refuted outright.

---

## Open questions / for Victor

1. **Your wife's phone.** What phone and OS does she use? If Android (66% of Mexico), test: does the keyboard open on load, and does a right-edge swipe trigger Back?
2. **Paper or rows?** Decide after the clickable mock-up test, not before.
3. **Struck items.** Stay in place (paper) or sink to "Tachados" (rows, like OurGroceries)?
4. **Long-press.** A small Editar/Borrar menu (proposed) or direct edit? Is drag-to-reorder needed in checkpoint 1? It competes with long-press.
5. **Splitting on " y ".** Should "huevos y leche" become two items? Only commas is the safe default.
6. **Aisle corrections.** Remember "move to another aisle" per list now, or in checkpoint 2?
7. **Notifications.** "Your wife added an item" needs web push, which needs a server. Skip for now, given zero server cost?
8. **No Watch or widgets.** A web app can't offer Apple Watch or lock-screen widgets (a common complaint when competitors removed them). Acceptable?
9. **Home-screen URL.** Verify on-device that the shared-list URL (with `?room=`) is what the home-screen icon opens, with and without a manifest `start_url`.
10. **Spanish button label.** Check on-device the exact Spanish (Mexico) wording of "Add to Home Screen" before writing the install-hint steps.
11. **Presence pings.** A ping every 5 s costs battery and data in the store. Pass this to the sync research track.
12. **Public broker.** The app uses the public HiveMQ broker (`wss://broker.hivemq.com:8884/mqtt`). This is outside the UX scope, but it matters for reliability. Flag it for the sync track.

---

## Claim ledger

| ID | Topic | Status | Source date checked |
|---|---|---|---|
| C01 | Progressive disclosure | ✅ | 2006-12-03 |
| C02 | Choice overload moderators | ✅ | 2014-08-29 |
| C03 | Hick's law takeaways | ✅ | undated |
| C04 | Icon labels | ✅ | 2014-07-27 |
| C05 | Hidden navigation | ✅ | 2016-07-24 |
| C06 | Swipe discoverability, undo | ✅ | 2017-02-12 / 2019-03-17 |
| C07 | HIG custom gestures | ✅ | 2024-09-09 |
| C08 | Bottom sheets | ✅ | 2023-06-11 |
| C09 | Edges / Fitts | ✅ (one detail ❓) | 2022-07-31; 2023-04; 2026-03-25 |
| C10 | Target sizes | ✅ | 2025-12-16; 2025-06-09 |
| C11 | Recognition vs recall | ✅ | 2024-01-15 |
| C12 | Confirmation dialogs | ✅ | 2018-02-18 (rev. 2026-08-07) |
| C13 | Empty states | ✅ | 2021-09-19 |
| C14 | Drafts | ✅ | undated |
| C15 | "Less is more" review | ✅ | 2026-09-06 |
| C16 | 2026 complaint themes | ✅ | 2026-03 to 2026-09 |
| C17 | Partner sync failures | ✅ | 2026-01 to 2026-08 |
| C18 | Praise keyword shares | ✏️ | fetched 2026-09-25 |
| C19 | Accounts to share | ✏️ | undated / 2023-05-22 / 2025-03-28 |
| C20 | Reminders Groceries | ✅ | 2025-12-11 |
| C21 | Grocery app | ✏️ | 2026-07-19 |
| C22 | Notes checklists | ✅ | 2025-02-11 |
| C23 | todo.txt | ✅ | 2026-06-28 |
| C24 | Sync granularity | ✅ | 2026-07-08 |
| C25 | Notion CRDT | ✅ | 2026-09-18 |
| C26 | autocorrect Baseline | ✅ | 2026-09-11 |
| C27 | iOS keyboard on focus | ✅ (Android ❓) | 2024-03-19; 2026-09-17 |
| C28 | Voice input | ✅ (+) | 2026-08-19; 2026-09-23 |
| C29 | Web haptics | ✏️ | 2024-09-16; undated |
| C30 | Zoom disabled | ✏️ | 2025-01-18; 2017-02-02; 2020-12-15 |
| C31 | Strike-through and screen readers | ✅ | 2025-04-18 |
| C32 | Dark mode | ✅ | 2024-08-06 |
| C33 | iOS 26 Home Screen web apps | ✅ | 2025-09-15; 2025-10-10 |
| C34 | 7-day storage cap exemption | ✅ | undated |
| C35 | Mexico OS share | ✅ | Aug 2026 |
| C36 | es-MX style | ✅ | 2024-09-05 |
| C37 | Prototypes, dogfooding | ✅ | 2026-09-11; 2026-08-07 |
| C38 | Liquid Glass, M3 Expressive | ✅ | 2025-10-10; date not shown |
| C39 | Blocking overlay | ✅ (+) | code 2026-09-25 |
| C40 | Payload sizes | ✅ | code 2026-09-25 |
