📝 ListoLista

"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupéry

ListoLista is a "Pragmatic Minimalist" list application designed for speed, sovereignty, and offline resilience. It rejects modern software bloat in favor of raw utility.

🏗 Design Philosophy

Velocity of Thought: The app loads in 0ms and auto-focuses the input. No loading screens, no login walls.

The Spreadsheet Benchmark: If a feature isn't faster or more intuitive than a spreadsheet cell, it is rejected.

Digital Sovereignty: Your data lives on your device (localStorage) or in files you own (.json). No cloud servers.

Anti-Slop Architecture: The code is written in "Vanilla" HTML/JS with zero external dependencies, ensuring it works even on 2G connections or offline.

⚡️ Features

The Input Waterfall

Two fixed input slots (#in-1, #in-2) remain static at the top of the screen.

Why? This prevents the UI from "jumping" under your finger when you submit a task, allowing for rapid-fire brain dumping.

Life & Death Sorting

The Living (Pending): Sorted FIFO (Oldest First). Encourages clearing the backlog.

The Dead (Completed): Sorted LIFO (Newest First). Shows your most recent wins at the top of the graveyard.

File Sovereignty

💾 Save: Exports your list as a portable .json file.

📂 Open: Restores a list from a file (works offline).

🔗 Share: Copies a formatted text version to your clipboard for WhatsApp/Slack.

🛠 Technical Architecture

Stack: HTML5, CSS Variables, ES6 JavaScript.

Single File: The entire app logic resides in index.html.

Persistence: Uses localStorage (Key: listolista_v1) for session retention.

State Management:

Single Source of Truth: App.state

Unidirectional Flow: Input -> State Update -> Save -> Render

Data Schema

{
  "id": 1735411200000,
  "text": "Buy coffee",
  "done": false,
  "ts": 1735411200000, // Created At
  "dt": null           // Completed At
}


🚀 Deployment & Usage

Online (GitHub Pages)

Fork this repository.

Enable GitHub Pages in Settings > Pages.

Access via https://[username].github.io/listolista.

Offline (The "Stone Age" Method)

Download index.html.

Save it to your phone or desktop.

Open directly in any browser. No internet required.

🤖 AI Collaboration

This project was built using a Human-in-the-Loop workflow with Google Gemini.

Role: Human Operator (Architect/Product Owner) & Gemini (Junior Engineer/Vibe Coder).

Workflow: Conversational iterations -> "Code Golf" optimization -> Manual Review.

Transparency: All code was generated via the Gemini Canvas interface and reviewed for "AI Slop" (unnecessary complexity) before committing.
