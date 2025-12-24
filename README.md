Goal Zero: Technical Manifesto & Debugging Guide

Project: Goal Zero (L0)
Version: Option B (Pragmatic Utility)
Philosophy: Pragmatic Minimalism / Velocity of Thought

1. TO THE AI DEVELOPER (CONTEXT)

If you are an AI reading this codebase for refactoring, debugging, or scaling:

This application is built on the "Anti-Slop" principle.

No Frameworks: Do not suggest React, Vue, or Tailwind unless explicitly requested. We use native DOM APIs for performance and "Stone Age" compatibility.

Explicit State: The App.state object is the Single Source of Truth. Do not store state in the DOM (e.g., checking class names to determine if an item is done).

Modular Logic: All logic is encapsulated in the App namespace. Do not write global functions.

2. DATA SCHEMA

The application uses a simple, flat array of objects stored in App.state.items.

Field

Type

Description

id

number

Date.now() at creation. Used as the unique key for toggling/deleting.

text

string

The user's input. Sanitize if adding HTML rendering capabilities later.

done

boolean

false = Living (Pending), true = Dead (Completed).

timestamp

number

Creation time. Used to sort Pending items (FIFO).

deathTime

number|null

Timestamp of completion. Used to sort Completed items (LIFO).

3. ARCHITECTURE & CONTROL FLOW

The Input Waterfall

The top of the UI contains two fixed inputs (#in-1, #in-2).

Why two? To prevent the "UI Jump". When a user hits Enter, the data moves to the list, but the input remains fixed. Having a second slot allows for rapid-fire entry without waiting for animations.

Commit Triggers: keydown (Enter) and blur.

The Partitioned Render

The App.render() function destroys and rebuilds the list on every state change.

Partitioning: The array is split into pending and completed arrays at render time.

Sorting Logic:

Pending: a.timestamp - b.timestamp (Oldest First).

Completed: b.deathTime - a.deathTime (Newest First).

4. DEBUGGING GUIDE

Common Failure Modes

Issue 1: Input not committing on mobile.

Cause: The blur event might fire before click events if the user taps "Delete" on another item immediately.

Fix: Checks the setTimeout delay in bindEvents. Currently set to 100ms to allow other events to register first.

Issue 2: "X" button toggles the item instead of deleting it.

Cause: Event Bubbling. The click on the "X" propagates up to the parent div, which has the toggleItem listener.

Verification: Ensure e.stopPropagation() is called in deleteItem(id, e).

Issue 3: Scroll "stuck" or body scrolling instead of list.

Cause: CSS overflow misconfiguration.

Verification: Ensure body { overflow: hidden; } and #viewport { overflow-y: auto; }. The body must be locked to force the viewport div to handle the scroll.

5. FUTURE ROADMAP (SCALABILITY)

When scaling this application, follow this order of operations:

Persistence: Implement localStorage in App.init (Load) and App.commitInput/App.toggleItem/App.deleteItem (Save).

PWA: Add manifest.json and serviceWorker.js to enable "Add to Home Screen" and offline caching.

Sync: (Far Future) Replace App.state.items with a Firebase/Supabase real-time listener.
