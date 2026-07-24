# AI Agent-Based Virtual Campus Tour — Global Academy of Technology

## Master Build Guide + Claude Code Prompts

This is your working document for the whole major project. It's organized into **7 phases**, built one at a time, each independently runnable and demoable. Each phase has:

1. A **copy-paste prompt** for Claude Code (VS Code terminal)
2. **What to check** before moving on
3. **Report-ready talking points** (for your review panel)

\---

## 0\. Two corrections to your spec (read this first)

**"RAG chatbot with RNN response"** — A pure RNN/LSTM generating natural-language answers went out of use around 2017; nobody builds RAG on top of one, and a panel that knows ML will flag it. Instead:

* The **generator** is an LLM (Claude via API) grounded on retrieved chunks — this is the actual "RAG" your spec asks for.
* The **RNN component** is a small **LSTM intent classifier** that runs *before* retrieval, tagging each query as `admissions | academics | facilities | navigation | general`. This is a real, legitimate use of an RNN, it's small enough to train yourself on the Kaggle dataset, and it feeds directly into the multi-agent router in Phase 3. You get to say "I implemented an RNN" truthfully in your report, and the chatbot still works well.

**"Separate agent per user for concurrency"** — these are two unrelated things:

* **Multi-agent** = specialist agents (Admissions, Academics, Facilities, Navigation) coordinated by a Supervisor agent that routes each query to the right specialist. This is an *architecture* decision, independent of how many people are using the site.
* **Handling many simultaneous users** = a backend engineering concern: async request handling, per-session context isolation, connection pooling, rate limiting. This is what actually keeps the site responsive under load.

Both are in the plan below, correctly separated.

\---

## 1\. Tech stack (what Claude Code will actually install)

|Layer|Choice|Why|
|-|-|-|
|Frontend|React + Vite + Tailwind CSS|Fast, matches "attractive modern UI" ask, easy to theme|
|360° viewer|Pannellum (or Marzipano)|Free, JS-only, does Street-View-style panorama navigation with hotspots|
|3D map|MapLibre GL JS + a custom campus GeoJSON|Free, no API key lock-in, supports 3D tilt/extrusion|
|Backend|FastAPI (Python)|Async-native (needed for concurrency), plays well with LLM/RAG libs|
|Vector DB|ChromaDB (local, free)|Zero setup, good enough for a campus-sized KB|
|RAG generator|Claude API (Sonnet)|Grounded answering with citations|
|RNN intent classifier|PyTorch LSTM, trained on your Kaggle dataset|Fulfills the RNN requirement legitimately|
|Multi-agent orchestration|LangGraph (or a hand-rolled Python router — see Phase 3)|Supervisor + specialist agent pattern|
|Voice|Web Speech API (browser STT/TTS) — no server cost|"Voice to text in chatbox"|
|Multi-language|i18next (frontend) + Claude API translation (backend)|UI strings + dynamic answer translation|
|Concurrency|FastAPI async + Uvicorn workers + Redis session store|Many users, no interruption|
|Eval|Custom faithfulness/relevancy scorer using Claude-as-judge (RAGAS-style)|Matches your "groundedness evaluation" objective|

**Suggested Kaggle datasets for the placeholder knowledge base** (search these on Kaggle, pick one, download the CSV):

* "College Student Management System" / "University Dataset" (generic student/course/faculty tables) — good for academics-agent structured data
* "Indian College Admission Dataset" — good for admissions-agent Q\&A
* "FAQ Dataset for Chatbot" (general FAQ pairs, various domains) — reshape into GAT-style Q\&A pairs

You'll relabel column names/values to look like GAT (department names, course names) — Claude Code will do this relabeling for you in Phase 2.

\---

## 2\. End-to-end architecture

```
                        ┌─────────────────────────────┐
                        │   React Frontend (Vite)      │
                        │  Home | Tour | AI Assistant   │
                        │  360° Viewer | 3D Map | Voice │
                        └───────────────┬───────────────┘
                                        │ REST / WebSocket
                        ┌───────────────▼───────────────┐
                        │        FastAPI Gateway         │
                        │  (async, per-session context,  │
                        │   rate limiting, auth-lite)     │
                        └───────────────┬───────────────┘
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
      ┌─────────▼─────────┐  ┌──────────▼──────────┐  ┌─────────▼─────────┐
      │ RNN Intent         │  │  Supervisor Agent    │  │ Navigation Engine  │
      │ Classifier (LSTM)  │─▶│  (routes by intent)   │  │ (Dijkstra/A\* over  │
      └────────────────────┘  └──────────┬───────────┘  │ campus graph)      │
                                          │              └────────────────────┘
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
          ┌─────────▼──────┐   ┌──────────▼─────────┐  ┌────────▼────────┐
          │ Admissions Agent│   │ Academics Agent      │  │ Facilities Agent │
          └─────────┬──────┘   └──────────┬─────────┘  └────────┬────────┘
                    │                     │                     │
                    └──────────┬──────────┴──────────┬──────────┘
                               ▼                      ▼
                     ┌──────────────────┐   ┌───────────────────┐
                     │  ChromaDB (RAG)   │   │  Claude API (LLM)  │
                     │  vector retrieval │──▶│  grounded answer   │
                     └──────────────────┘   └───────────────────┘
                               │
                     ┌──────────────────┐
                     │ Faithfulness /    │
                     │ Relevancy Scorer  │
                     └──────────────────┘
```

**Concurrency, separately:** Uvicorn runs multiple async workers; each incoming user gets an isolated session object (session\_id in Redis or in-memory dict) holding their conversation history and current navigation state, so User A's "take me to the library" never leaks into User B's session. This has nothing to do with the number of agents — it's how the gateway is written.

\---

## Phase 1 — Frontend Shell (UI, theme, pages)

### Claude Code prompt

```
I'm building a React + Vite + Tailwind CSS frontend for a virtual campus tour
website for Global Academy of Technology (GAT), Bangalore — an engineering
college established 2001, \~10-acre campus in Rajarajeshwari Nagar, VTU-affiliated.

Set up the project with this structure:
- src/pages/Home.jsx        — hero section with full-bleed campus background
  image (use a placeholder gradient + generic Indian-engineering-college stock
  photo path for now, I will replace it later with my own Insta360 shots),
  college name, tagline "Growing Ahead Of Time", quick nav cards to
  Tour / AI Assistant / Admissions / Academics / Facilities / Contact
- src/pages/Tour.jsx         — placeholder container for the 360° panorama
  viewer (we'll wire Pannellum in Phase 5), with a location picker sidebar
  (Main Gate, Admin Block, Library, Auditorium, Hostel, Sports Ground,
  Canteen, Labs, Seminar Halls)
- src/pages/Assistant.jsx    — chat UI: message list, input box with a mic
  icon (wire voice in Phase 4), typing indicator, source-citation chips under
  AI answers
- src/pages/Admissions.jsx, Academics.jsx, Facilities.jsx, Contact.jsx —
  content pages, static for now, populated with real GAT facts I'll give you:
  established 2001, BE/MTech/MSc/MBA programs, VTU affiliated, NAAC A grade,
  AICTE approved, admission via KCET/COMEDK/PGCET/GATE/KMAT, hostel with
  separate boys/girls blocks, 450-seat auditorium + 2 seminar halls (90+ seats
  each), campus bus routes from Majestic/Shivajinagar/Kengeri/Jayanagar etc.
- src/components/Navbar.jsx, Footer.jsx, LanguageSwitcher.jsx (placeholder
  dropdown, we wire real i18n in Phase 6)

Design direction:
- Color theme: deep navy/maroon + gold accent (typical Indian engineering
  college branding), clean sans-serif headings, generous whitespace, subtle
  glassmorphism on nav cards over the hero image
- Fully responsive, mobile-first
- Use Tailwind only, no component library
- Add smooth scroll and a subtle fade-in-on-scroll animation for sections

Do not build any backend yet. Use React Router for navigation between pages.
Give me a working `npm run dev` app when done.
```

### Check before moving on

* `npm run dev` boots cleanly, all pages route correctly
* Hero background renders (even as placeholder), nav cards work
* Looks intentional, not like a Bootstrap default — if it looks generic, tell Claude Code: *"make the hero and nav cards more visually distinctive, reduce use of default shadows/rounded corners, add a signature color accent"*

\---

## Phase 2 — RAG Knowledge Base + RNN Intent Classifier

### Claude Code prompt

```
Now build the RAG backend for the AI assistant.

1. Create a `data/` folder. I'll place a Kaggle CSV there (college FAQ /
   student dataset). Write a Python script `scripts/build\_kb.py` that:
   - Loads the CSV
   - Relabels/rewrites entries so they read as Global Academy of Technology
     content (department names -> CSE/ISE/ECE/EEE/ME/CE, generic college name
     -> "Global Academy of Technology" / "GAT")
   - Also hand-add \~30 real GAT facts I'll paste in (admissions process,
     facilities, contact info, campus locations) as additional documents
   - Chunks all text (\~300 tokens/chunk, 50 token overlap)
   - Embeds chunks and stores them in a local ChromaDB collection called
     "gat\_kb", persisted to disk

2. Build a FastAPI backend in `backend/`:
   - `POST /api/chat` endpoint: takes {session\_id, message}
   - Retrieves top-5 relevant chunks from ChromaDB for the message
   - Calls the Claude API with a system prompt instructing it to answer
     ONLY from the provided chunks, cite which chunk(s) it used, and say
     "I don't have that information in the campus knowledge base — would
     you like me to note this for the admin?" if nothing relevant is found
   - Returns {answer, sources: \[chunk\_ids], confidence}

3. Build an RNN intent classifier in `backend/intent\_model/`:
   - A small PyTorch LSTM (embedding layer -> LSTM -> dense -> softmax)
   - Trains on the same Kaggle dataset's query column, labeled into 5
     classes: admissions, academics, facilities, navigation, general
     (write a simple heuristic labeler based on keywords if the dataset
     has no labels, then let me manually review 50 samples)
   - Save the trained model as intent\_model.pt
   - Expose a Python function `classify\_intent(text) -> str` that loads
     the model and returns the predicted class
   - Wire this into /api/chat: classify intent first, log it, and pass it
     as metadata to the RAG call (we'll use it for real routing in Phase 3)

Do not build the multi-agent router yet — that's next phase. For now /api/chat
should work end-to-end: user question -> intent tag -> RAG retrieval -> Claude
answer -> response with citations.

Connect the Phase 1 Assistant.jsx chat UI to this endpoint.
```

### Check before moving on

* Ask it a real GAT question ("What courses does GAT offer?") and confirm the answer cites a source chunk
* Ask it something NOT in the KB ("What's the mess menu on Tuesdays?") and confirm it refuses gracefully instead of hallucinating
* Check `intent\_model.pt` was created and `classify\_intent()` returns sane labels on 5–6 test sentences

### Report-ready talking point

"Groundedness is enforced at the prompt level (answer-only-from-context) and validated in Phase 7 with an automated faithfulness scorer."

\---

## Phase 3 — Multi-Agent Supervisor Architecture + Concurrency

### Claude Code prompt

```
Refactor /api/chat into a proper multi-agent system, and separately harden
the backend for concurrent users.

MULTI-AGENT (routing by intent):
- Build backend/agents/supervisor.py — takes the RNN's intent label +
  the message, and routes to one of:
  - agents/admissions\_agent.py
  - agents/academics\_agent.py
  - agents/facilities\_agent.py
  - agents/navigation\_agent.py (this one does NOT call the LLM — it calls
    the pathfinding module we'll build in Phase 5; for now just stub it to
    return "Navigation coming in Phase 5")
  - agents/general\_agent.py (fallback for anything unclear)
- Each specialist agent has its own system prompt tuned to its domain
  (e.g., admissions\_agent's prompt emphasizes eligibility/entrance exams/
  fees; facilities\_agent emphasizes hostel/library/sports/canteen) but all
  of them still retrieve from the same ChromaDB and must ground answers in
  retrieved chunks — no agent should answer from memory.
- If the supervisor is uncertain about intent (RNN confidence below a
  threshold, e.g. 0.55), have it ask ONE clarifying question instead of
  guessing (e.g., "Are you asking about admission process, or campus
  facilities?") rather than routing blindly.

CONCURRENCY (separate from the above):
- Add a session manager (in-memory dict keyed by session\_id for now, note
  in a comment that this should move to Redis for real deployment) that
  stores each user's conversation history and last-known map position
  independently
- Make sure all I/O (ChromaDB queries, Claude API calls) is truly async
  so one user's slow request doesn't block another's
- Add basic rate limiting per session\_id (e.g. max 20 messages/minute) to
  prevent one client from starving others
- Write a small load test script (scripts/load\_test.py using asyncio +
  httpx) that fires 50 concurrent chat requests with different session\_ids
  and confirms responses come back correctly matched to their session and
  within a reasonable time

Log which agent handled each request so I can show routing decisions in
my project report/demo.
```

### Check before moving on

* Ask an admissions question and a facilities question in the same browser tab — check backend logs show different agents firing
* Run `scripts/load\_test.py` — confirm 50 concurrent requests all return correctly and nothing crashes
* Ask a deliberately ambiguous question ("tell me about the college") — confirm it asks a clarifying question instead of guessing

\---

## Phase 4 — Voice Assistant

### Claude Code prompt

```
Add voice interaction to the Assistant.jsx chat page.

- Use the browser's built-in Web Speech API (SpeechRecognition for
  speech-to-text, SpeechSynthesis for text-to-speech) — no external voice
  API needed, keeps this free and offline-capable for demo purposes
- Clicking the mic icon in the chat input starts listening, shows a live
  waveform/pulsing animation, transcribes speech into the text box in
  real time, and auto-sends on a pause in speech (with a manual "stop"
  option too)
- Add a toggle: "Read answers aloud" — when on, the AI's text response is
  also spoken back using SpeechSynthesis
- Add voice-driven navigation commands: if the transcribed text matches
  patterns like "take me to X" / "navigate to X" / "show me X", instead of
  routing to the chat agents, directly trigger the Tour page's location
  loader for location X (we'll fully wire this in Phase 5) and switch the
  UI to the Tour page
- Handle unsupported browsers gracefully (Safari/Firefox have partial
  support) — show a text note "Voice input not supported in this browser,
  please type your question" instead of breaking
```

### Check before moving on

* Test in Chrome (best Web Speech API support) — speak a question, confirm it transcribes and gets answered
* Say "take me to the library" and confirm it at least attempts to switch to the Tour page (full pathfinding comes next phase)
* Test in a non-supporting browser — confirm it degrades gracefully, doesn't crash

\---

## Phase 5 — 360° Tour, Shortest-Path Navigation, 3D Map

This is the phase that depends on your Insta360 photos. Build it now with placeholder panoramas so the whole pipeline works, then swap in real photos later — Claude Code will set it up so that's a drop-in replacement, not a rebuild.

### Claude Code prompt

```
Build the virtual tour, navigation, and 3D map system.

1. CAMPUS GRAPH: create data/campus\_graph.json — a simple node/edge graph
   representing GAT's key locations (Main Gate, Admin Block, Library,
   Auditorium, Canteen, Hostel Block, Sports Ground, CSE Block, ECE Block,
   Seminar Hall 1, Seminar Hall 2, Parking) with approximate walking
   distances between connected nodes (I'll refine exact distances once I
   have the real campus layout — use plausible placeholder values based on
   a \~10-acre campus for now).

2. PATHFINDING: backend/navigation/pathfind.py — implement Dijkstra (or A\*
   with straight-line heuristic) over campus\_graph.json. Expose
   POST /api/navigate {from, to} -> {path: \[node names], total\_distance,
   estimated\_walk\_time, turn\_by\_turn: \["Exit Main Gate, head north...", ...]}
   The navigation\_agent from Phase 3 should call this and turn the raw path
   into a friendly spoken/written direction summary via Claude.

3. 360° TOUR VIEWER: install Pannellum. In Tour.jsx:
   - Each campus\_graph.json node maps to one panorama image
   - For now, use royalty-free 360° placeholder panoramas (I'll tell you
     where to source 2-3 free equirectangular test images, or generate flat
     placeholder images with a "360 PLACEHOLDER — \[Location Name]" label if
     none are available) stored in public/panoramas/{node\_id}.jpg
   - Add clickable hotspots on each panorama linking to connected nodes
     (so users can "walk" from panorama to panorama, Street-View style)
   - When /api/navigate returns a path, auto-advance through that sequence
     of panoramas with a "Next stop: X" prompt, so it feels like a guided
     walk rather than free clicking
   - IMPORTANT: structure the code so swapping public/panoramas/{node\_id}.jpg
     for a real Insta360 equirectangular export is the ONLY step needed to
     go live with real photos — no other code changes required. Document
     this clearly in a README section "Adding your real 360 photos."

4. 3D MAP: install MapLibre GL JS. Add a MapView.jsx component:
   - Since there's no public GAT building-level 3D data, build a simple
     custom GeoJSON of the \~10-acre campus footprint with each
     campus\_graph.json node as a point, and fake building footprints as
     3D-extruded polygons (placeholder heights) so it visually reads as a
     3D campus map
   - Show the user's "current location" (last node visited in the tour) as
     a highlighted marker
   - When a path is returned from /api/navigate, draw it as a line on the
     map and animate the marker moving along it in sync with panorama
     advancement
   - Note clearly in code comments where I should later plug in real GPS
     coordinates surveyed from the actual campus, and where real building
     footprints (traced from a satellite image or campus site plan) should
     replace the placeholder polygons

Wire the mic command flow from Phase 4 ("take me to X") to call
/api/navigate and drive both the panorama sequence and the 3D map together.
```

### Check before moving on

* Type/say "take me to the library" — path computes, panorama viewer advances node-by-node, 3D map marker moves along a drawn route
* Click a hotspot manually in a panorama — moves to the connected node correctly
* Confirm the README section for swapping in real photos is clear enough that *future you*, months from now, can follow it without re-reading this whole guide

### When you do get your Insta360 photos

* Export each shot as an **equirectangular JPG** (Insta360 Studio app does this — look for "Export as Panorama" not "Export as Video")
* Name each file to match its `node\_id` in `campus\_graph.json` and drop it into `public/panoramas/`
* Update `campus\_graph.json` distances/positions using a phone GPS or by pacing out real distances
* If you also survey real lat/long per node, update the 3D map GeoJSON — the rest of the app doesn't need to change

\---

## Phase 6 — Multi-Language Support

### Claude Code prompt

```
Add multi-language support across the site.

- Install i18next + react-i18next for static UI strings (nav, buttons,
  page headers). Start with English, Kannada, and Hindi (relevant for a
  Bangalore college's actual user base). Wire the LanguageSwitcher
  dropdown from Phase 1 to actually change language site-wide.
- For the AI assistant, don't pre-translate the whole knowledge base.
  Instead: detect the user's message language (or use their selected UI
  language), and instruct the Claude system prompt to retrieve from the
  English KB as-is but ANSWER in the user's selected language, keeping
  proper nouns (GAT, VTU, department names) untranslated.
- Make sure voice input (Phase 4) also respects the selected language for
  SpeechRecognition's `lang` property, and TTS output uses a matching voice
  where the browser supports it.
```

### Check before moving on

* Switch language, confirm nav/buttons update
* Ask the assistant a question in Hindi, confirm it responds in Hindi while still citing sources correctly

\---

## Phase 7 — Groundedness Evaluation + User Testing

### Claude Code prompt

```
Build the evaluation pipeline for my project report.

1. Create eval/test\_questions.json — a fixed set of 25 questions covering
   all 4 domains (admissions/academics/facilities/navigation) plus 5
   deliberately out-of-scope questions (to test refusal behavior) and 5
   ambiguous ones (to test clarification behavior).

2. Build eval/run\_eval.py that, for each question:
   - Sends it to /api/chat and records the answer + cited sources
   - Uses a SEPARATE Claude API call as a judge, given the question, the
     answer, and the actual retrieved source chunks, to score:
     - Faithfulness (1-5): does the answer only state things supported by
       the retrieved chunks?
     - Answer relevancy (1-5): does the answer actually address the
       question asked?
   - Also flags: did an out-of-scope question get correctly refused? did
     an ambiguous question get a clarifying question instead of a guess?
   - Outputs eval/results.csv and a summary eval/report.md with average
     scores per category and a few example transcripts (good and bad)

3. Add a simple eval/README.md explaining how to re-run this and how to
   interpret the numbers for a project report / viva.
```

### Check before moving on

* Run the eval, read `report.md` — do the faithfulness/relevancy numbers look plausible (not suspiciously perfect, not near-zero)?
* Manually spot-check 3-4 transcripts against the judge's score — does the judge's reasoning make sense?

\---

## 3\. Suggested build order in one line each

1. `Phase 1` → look and feel exist, nothing is wired yet
2. `Phase 2` → chatbot answers real questions with citations
3. `Phase 3` → chatbot has specialist agents + survives concurrent load
4. `Phase 4` → you can talk to it
5. `Phase 5` → the actual "virtual tour" — panoramas + 3D map + pathfinding
6. `Phase 6` → works in Kannada/Hindi/English
7. `Phase 7` → numbers for your report

## 4\. How to run each phase in the VS Code terminal

```bash
# one-time setup
git init
python -m venv venv \&\& source venv/bin/activate   # (venv\\Scripts\\activate on Windows)

# then for each phase, open Claude Code and paste that phase's prompt:
claude

# after Claude Code finishes a phase, actually run and test it before
# starting the next phase's prompt — don't chain prompts blindly
npm run dev              # frontend, in one terminal tab
uvicorn backend.main:app --reload   # backend, in another tab
```

Give Claude Code **one phase at a time**, exactly as written above (edit the placeholder facts/paths as your project evolves). After each phase, actually click through the feature before pasting the next prompt — that's the fastest way to catch a wrong assumption before it compounds into the next phase.

