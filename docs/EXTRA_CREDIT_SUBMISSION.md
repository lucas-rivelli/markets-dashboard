# FMKT 256 — Extra Credit Project on AI
## Markets Reading: An AI-Built Finance Research App

> **This file is the complete deliverable source document.**
> It contains (1) a copy-paste prompt for Claude to generate the slides, (2) a slide-by-slide deck with speaker notes, and (3) the full written report that becomes the submitted PDF.
> Send **this entire file + screenshots** (see §7 Shot List) to Claude and ask for the deck. Then export the deck to PDF and submit that PDF on Canvas.

*Course: FMKT 256 · Fall 2026 · Deadline: Tuesday, November 3 at 1:00 PM · Submit as PDF on Canvas Assignments*

---

## ⚠️ FILL IN BEFORE SUBMITTING

| Field | Value |
|---|---|
| Team members (3–4 required) | `[NAME 1] · [NAME 2] · [NAME 3] · ([NAME 4])` |
| Prompt chosen | **Prompt 1 — Build a finance app using Claude or ChatGPT** |
| App name | Markets Reading: Signals |
| Live app | https://markets-signals.vercel.app |
| Source code (public) | https://github.com/lucas-rivelli/markets-dashboard/tree/fmkt256-signals |
| Date | `[e.g. November 2, 2026]` |

> **Graded product = Signals (login-free).** Open https://markets-signals.vercel.app in an incognito window — no password, no Vercel login wall. Hero feature is the **Must-Read** queue (“Screeners flag tickers. Signals tells you what to read.”). Setup/reference: `docs/SIGNALS.md`. The personal Markets Reading app at `markets-dashboard-knowledgemaxxing.vercel.app` is a separate project and still has a device gate — **do not** put that URL in the PDF.

---

## 0. Copy-Paste Prompt for Claude (Slides)

Copy everything in the box below into Claude together with this file and the screenshots from §7.

```
You are designing a slide deck for a college finance course extra-credit project
(FMKT 256, Fall 2026, Prompt 1: "Build a finance app using Claude or ChatGPT").

Read the attached file EXTRA_CREDIT_SUBMISSION.md in full. Build a 14-slide deck
exactly following "Part 1 — Slide-by-Slide Deck" in that file:
- Use each slide's Headline as the slide title (assertion-style, not a topic label).
- Put only the "On-slide copy" on the slide itself. Do NOT put speaker notes on slides.
- Follow each slide's "Visual" instruction. Where it says [SCREENSHOT n], use the
  attached screenshot with that number; where it says [DIAGRAM], build the diagram
  from the text description.
- Keep every number exactly as written in the "Fact Sheet" (§8). Do not invent
  metrics, returns, user counts, or testimonials. Where a field is in [BRACKETS],
  leave the bracket visible so I can fill it in.

Design system (match the app itself — this is part of the story):
- Background: flat parchment #f3ecdd. No gradients, no shadows, no rounded cards.
- Type: EB Garamond (serif) for everything; slide titles in letterspaced small caps.
- Ink: warm near-black #292018. Single accent: deep vermilion #7f2a1a.
  Secondary accent (sparingly): muted gold #96762f.
- Hairline rules (#d8cbae) to separate regions. A small ❦ fleuron as the brand mark.
- No emoji, no stock photos, no generic blue SaaS theme. It should look like a
  rubricated manuscript / private reading room.

Format: 16:9. Export-ready. At the end, also give me (outside the deck) a list of
any [BRACKETED] fields I still need to fill in.

After the deck, I will export it to PDF myself for Canvas submission, so make sure
all links (live app, GitHub) are clickable hyperlinks in the slides.
```

---

# PART 1 — SLIDE-BY-SLIDE DECK (14 slides)

> Reading guide for each slide: **Headline** = slide title · **On-slide copy** = what the audience sees · **Visual** = what Claude should draw/use · **Speaker notes** = what you say if presenting / what can go in PDF notes · **Evidence** = source for the claim (for your own fact-checking, not necessarily on-slide).

---

### Slide 1 — Title

- **Headline:** `❦ MARKETS READING — A Finance App Built With AI`
- **On-slide copy:**
  - FMKT 256 · Extra Credit Project on AI · Fall 2026
  - Prompt 1: Build a finance app using Claude or ChatGPT
  - `[TEAM MEMBER 1] · [TEAM MEMBER 2] · [TEAM MEMBER 3]`
  - Live app + code — clickable links (see footer)
- **Visual:** Title only, centered, manuscript style. Large EB Garamond, vermilion fleuron ❦ above the title, double hairline rule underneath. Nothing else.
- **Speaker notes:** "We built a working finance app with AI. It's live on the web today — the link is on this slide, it needs no login *[after blocker fix]*, and everything we show is a real screenshot of the running product, not a mockup."
- **Footer (small, clickable):** Live app: markets-signals.vercel.app · Code: github.com/lucas-rivelli/markets-dashboard/tree/fmkt256-signals

---

### Slide 2 — The Problem

- **Headline:** `Good market research is scattered across a dozen inboxes`
- **On-slide copy:**
  - Newsletters on Substack, videos on YouTube, podcasts on Spotify, ideas on X, fund letters on fund websites
  - Checking each one separately = missed pieces, repeated pieces, no memory of what you already read
  - Nothing connects them: a macro view in a podcast never sits next to the fund letter that disagrees with it
- **Visual:** Simple diagram: 6 source logos/names (Substack, YouTube, Spotify, X, Blogs, Fund letters) as scattered boxes with arrows pointing at a single overwhelmed reader icon / "12 tabs open". Hand-drawn manuscript style, no stock art.
- **Speaker notes:** "This is the problem from the investor's chair. The raw material for learning markets — research letters, macro commentary, investor interviews — is better than ever, but it's fragmented. The cost isn't money, it's attention and continuity: you can't build a view if you can't see everything in one place, in order, and remember what you've already processed."
- **Evidence:** `project.md` §"The problem it solves".

---

### Slide 3 — The Product (Hero Screenshot)

- **Headline:** `One reading room for everything you follow — updated every 5 minutes`
- **On-slide copy:**
  - A single merged timeline of newsletters, blogs, YouTube, podcasts, X bookmarks & fund letters
  - Read, file, tag and save without leaving the page — on desktop or phone
  - Live today: *[live URL]* (no login required)
- **Visual:** `[SCREENSHOT 1]` — full desktop app, four regions visible (rail · list · reading pane · map). This is the money slide; make the screenshot as large as the slide allows.
- **Speaker notes:** Walk the four regions left to right: "Rail — Inbox, folders, tags. List — the merged timeline. Reading pane — the opened piece, video and podcasts play inline. Right column — a map of your tags and what you read recently. Unread items carry a small vermilion mark; once read, they fade like absorbed ink."
- **Evidence:** `Claude.md` UI architecture; `sota.md` §4.

---

### Slide 4 — Which Prompt, Which App Type

- **Headline:** `Prompt 1, "other types welcome": a research & visualization app — with the required data engine underneath`
- **On-slide copy:**
  - The brief lists screeners, simulators, visualization tools and trading games — *"projects of other types are welcome"*
  - Markets Reading is a **research-aggregation and visualization tool**: it visualizes your information flow (timeline, tag map, library) instead of a price chart
  - It meets the brief's one hard constraint: **it imports historical data and updates itself when new data arrives** (next slide)
- **Visual:** Small table mapping the brief's four example types → "Not this / This" — with Visualization + Other highlighted. Keep to 5 rows max.
- **Speaker notes:** "We want to be explicit about fit. This is not a screener and not a trading game. The brief explicitly welcomes other types, and its only universal constraint is historical import plus live updating. That constraint is exactly what this app is engineered around, so the next slide proves it line by line."
- **Evidence:** Assignment PDF (Prompt 1, final sentence).

---

### Slide 5 — Historical Import + Live Updating (The Hard Constraint)

- **Headline:** `Historical data in, new data automatically — no manual refresh, ever`
- **On-slide copy (table):**

  | Source type | Historical import | How it updates |
  |---|---|---|
  | RSS (Substack / blogs / YouTube) | Latest items per feed on first load | Re-fetched every 5 min |
  | Spotify podcasts | Saved shows, episodes from last 30 days | API refresh on schedule, rate-limit-safe cache |
  | X bookmarks | Bookmark archive imported via local sync tool | Re-synced to the repo, merged into feed |
  | Fund letters (Verde, Mauboussin) | Latest letter per fund | Daily automated scrape → cache |
  | Value Investors Club | Cached idea feed | Local scheduled agent refreshes cache |

- **Visual:** The table above + a thin timeline strip underneath: `First visit → historical import → 5-min refresh → daily cron (7 AM ET) → daily fund-letter & briefing runs`.
- **Speaker notes:** "Two halves. Import: the first time the app runs, it pulls each source's existing content — RSS back-catalogue, 30 days of podcast episodes, your bookmark archive, the latest fund letter per fund. Update: a 5-minute refresh cycle, a daily morning cron, and scheduled jobs for fund letters and X bookmarks keep it current whether or not anyone has the page open. Saved items are stored as plain files in git, so history is never lost when a feed item rotates out."
- **Evidence:** `lib/feed-cache.js` (`REFRESH_MS = 5 min`), `vercel.json` cron `0 12 * * *`, `.github/workflows/` (`feed-refresh`, `sync-fund-letters`, `sync-bookmarks`, `briefing-daily`, `wiki-daily`), `sota.md` §3.

---

### Slide 6 — Live Demo Script

- **Headline:** `Two minutes inside the app`
- **On-slide copy (numbered demo steps):**
  1. Open the live link → the timeline loads instantly from a snapshot, then syncs
  2. Click a piece → read / watch / listen inline; it fades as "seen"
  3. File it to a folder, tag it by theme (`AI-capex`, `macro-rates`…)
  4. Remove the *To-read* tag → it is saved permanently to the library
  5. Add any article/video/podcast URL with **＋ Add** → it appears in the Inbox
- **Visual:** `[SCREENSHOT 2]` (list + reader close-up) and `[SCREENSHOT 3]` (Add-link popover or folder/tag picker). If presenting live, this slide is the cue to switch to the browser.
- **Speaker notes:** "If we only had two minutes, this is the demo. Notice step 4 — that's the funnel in action: everything arrives as *To-read*, and only what survives triage becomes permanent. And step 5 matters for grading repeatability: any new source can be added from inside the app, no code."
- **Evidence:** `Claude.md` (Add piece, Writing, mailbox states); `project.md` §"What you can do with an item".

---

### Slide 7 — The Funnel (Core Idea)

- **Headline:** `Firehose → Triage → Library: from information overload to a knowledge base`
- **On-slide copy:**
  - **Firehose** — everything published by followed sources, merged. Job: coverage.
  - **Triage** — file by folder, tag by theme, trash the rest. Job: judgment.
  - **Library** — keepers saved as plain-text files in git, enriched (full text, transcripts, highlights). Job: memory you can query with AI.
- **Visual:** `[DIAGRAM]` Horizontal funnel: three labeled stages with arrows. Under each, one line of on-slide copy. Vermilion only on the arrows/current stage.
- **Speaker notes:** "This funnel is the actual investment idea of the project. Professional research is a funnel: you scan widely, you spend judgment on a few things, and you keep a small, high-quality record. Most tools stop at the firehose. This app's library layer stores saved pieces as versioned plain files — which means an AI assistant can later read, search and reason over your own research history. That's where this is going, and a first version already runs (slide 10)."
- **Evidence:** `sota.md` §1, §5; `project.md` §"Where it's going".

---

### Slide 8 — What Arrives Automatically (Source Inventory)

- **Headline:** `22 sources across 6 formats — one timeline`
- **On-slide copy (grouped, names small):**
  - **Substack/newsletters:** Jordi Visser, Citrini Research, Ray Dalio, ARK Next Gen Internet, Rebound Capital, Works in Progress, + investor letters/blogs
  - **Video & audio:** YouTube channels, Spotify saved podcasts (last 30 days)
  - **Social:** X bookmarks (synced locally, then merged)
  - **Institutional:** Value Investors Club ideas · Verde Asset fund letters · Michael Mauboussin's latest writing
  - **Your own:** links you add in-app, pieces you write in-app
- **Visual:** `[SCREENSHOT 4]` — Sources launchpad view (grouped by category). Fallback: the grouped list above as a clean two-column layout.
- **Speaker notes:** "Breadth is the point: a Substack macro view, a Verde fund letter from Brazil, a VIC stock idea and a podcast interview land in the same chronological list. Adding a normal RSS source is one entry in one config array; adding a fund is one entry in a JSON config — no new code (slide 11)."
- **Evidence:** `api/feed.js` `BASE_SOURCES` (22 named entries incl. dynamic sources), `data/fund-letters-config.json` (4 Verde funds + Mauboussin). See Fact Sheet §8 — do not change the count without re-counting.

---

### Slide 9 — Triage: Folders, Tags, Highlights

- **Headline:** `Triage is email-grade: folders, theme tags, highlights, bulk actions`
- **On-slide copy:**
  - Hierarchical folders (`Macro/Rates`), theme tags (`semis`, `AI-capex`, `macro-rates`…)
  - Gmail-style workflow: bulk select, keyboard shortcuts (J/K, X, E, #), right-click menus
  - Select any text → **Highlight** → the quote is saved and synced
  - Everything syncs across phone and computer
- **Visual:** `[SCREENSHOT 5]` — tag map (right column) + a highlighted passage in the reader. Two smaller screenshots side by side is fine.
- **Speaker notes:** "Coverage without triage is just a bigger pile. So the app borrows the most refined triage UI ever built — email. Folders behave like email folders, including subfolders; tags cut across sources by idea; highlights capture the one paragraph that mattered. State syncs server-side, so triage done on your phone is done on your laptop."
- **Evidence:** `Claude.md` (Folders, Highlights, List shortcuts, cross-device sync via `PUT /api/workspace`).

---

### Slide 10 — The AI Layer

- **Headline:** `AI does three jobs: it built the app, it briefs you daily, and it maintains your wiki`
- **On-slide copy:**
  1. **Built with AI** — designed and coded with Claude / AI coding assistants (vanilla JS, no framework)
  2. **Daily briefing** — an automated job gathers global, Brazil & company headlines and has an LLM (Claude via OpenRouter) synthesize a short morning briefing
  3. **Self-maintaining wiki** — saved pieces are compiled into a linked wiki (62 source pages, 13 concept pages): summaries, key claims, open tensions — queryable by an AI assistant over plain files in git
- **Visual:** Three horizontal bands, one per job, each with a tiny label: `BUILD · BRIEF · REMEMBER`. Optional small inset: `[SCREENSHOT 6]` wiki overview page.
- **Speaker notes:** "Be precise here, because 'AI app' can mean anything. Job one: AI as builder — the codebase was produced with AI assistance, which is the brief's premise. Job two: AI as analyst — every morning at 07:30 São Paulo time a scheduled workflow collects headlines and an LLM writes the briefing. Job three: AI as librarian — saved research is ingested into a wiki with concept pages like *AI (markets)* and *Macro*, plus a tensions page that surfaces where sources disagree. Knowledge stays in plain text in git — no proprietary database — so any future AI tool can read it."
- **Evidence:** `lib/briefing-gather.js`, `lib/briefing-llm.js`, `data/briefing-config.json`, `.github/workflows/briefing-daily.yml` (07:30 America/Sao_Paulo); `lib/wiki-llm.js` (Anthropic API, factual JSON: summary / key_claims / tensions), `kb/wiki/` (62 sources, 13 concepts, 4 entities), `.github/workflows/wiki-daily.yml`. **Caveat for honesty:** wiki LLM enhancement runs when an API key is configured; the wiki structure itself is generated regardless.

---

### Slide 11 — Repeatability (Extra Value in the Brief)

- **Headline:** `New source, new fund, new topic — configuration, not code`
- **On-slide copy:**
  - Add an RSS source: one entry in the sources array → deploy → it is in the timeline
  - Add a fund letter: one JSON entry (`name`, `mode`, fund ID) → daily job picks it up
  - Add a one-off piece: paste the URL in **＋ Add** inside the app
  - Change the briefing: edit topics/companies in one JSON config (e.g. Nvidia, Motiva, Ecorodovias, "Chinese AI open models")
- **Visual:** Two small code/config snippets side by side (source entry; fund entry from `data/fund-letters-config.json`). Real snippets from the repo, syntax in monospace, kept short (≤8 lines each).
- **Speaker notes:** "The brief gives extra value to work that 'can be repeated with new companies or updated data without additional coding.' That's this slide. Sources, funds and briefing topics are all data, not code. A classmate could fork this, swap in their own Substacks and funds in an afternoon, and have a working app."
- **Evidence:** `README.md` §"Adding and removing sources"; `data/fund-letters-config.json`; `data/briefing-config.json`; `api/manual-link.js`.

---

### Slide 12 — Architecture

- **Headline:** `Deliberately boring architecture: one HTML file, serverless APIs, git as the database`
- **On-slide copy:**
  - **Frontend:** single-file vanilla JS app (`index.html`, ~5,000 lines) — no framework, no build step
  - **Backend:** Vercel serverless functions (`/api/feed`, `/api/workspace`, `/api/save`, `/api/writing`, …)
  - **Data:** JSON + Markdown in git (workspace, caches, knowledge base) — versioned, portable, AI-readable
  - **Automation:** GitHub Actions (daily letters/briefing/wiki) + local Mac agent for login-walled sources (VIC, X)
- **Visual:** `[DIAGRAM]` Three layers top→bottom: `Browser (index.html)` → `Vercel serverless (api/ + lib/)` → `Git repo (data/ + kb/)`, with a side box `Schedulers: GitHub Actions · Vercel Cron · Mac LaunchAgent` and arrows into the backend. Build from the file map in Appendix A.
- **Speaker notes:** "The constraint-driven choices: serverless because it must update itself with nobody's laptop open; git as database because the library must be readable by AI tools and survive any vendor; a local agent only where a source (Value Investors Club, X) bot-checks datacenter IPs. Login-walled sources are never scraped from the server — the server only reads their caches. That separation is why the app is reliable day to day."
- **Evidence:** `sota.md` §2–3, §6; `HANDOFF.md` Architecture + file map; `vercel.json` (`ignoreCommand` skips deploys for data-only commits).

---

### Slide 13 — Limitations & Honest Risks

- **Headline:** `What it doesn't do (yet)`
- **On-slide copy:**
  - Not a screener, simulator or trading tool — it produces research inputs, not buy/sell signals or backtests
  - Feeds are capped (latest items per source); the permanent record is what you save, by design
  - Some sources depend on fragile third parties (Spotify rate limits, X/VIC logins expiring) — handled with caches, not eliminated
  - AI summaries can err — the wiki prompt is constrained to source text, and every page links back to the original
- **Visual:** Text only, four rows with hairline rules. Do not dress this up.
- **Speaker notes:** "We'd rather state the boundary than oversell. This app will not tell you what to buy. It makes the reading-and-remembering part of research systematic, and it keeps a clean, AI-queryable record. Its fragilities are the normal fragilities of building on other platforms, and the design answer throughout has been caching and plain files rather than pretending they don't exist."
- **Evidence:** `sota.md` §3, §5 (deferred items); `Claude.md` "What not to do".

---

### Slide 14 — Roadmap & Close

- **Headline:** `Next: ask your library questions`
- **On-slide copy:**
  - **Now:** firehose + triage + git-backed library + daily AI briefing + wiki
  - **Next:** in-app "Ask the KB" (chat over your saved research), automatic theme tagging of the whole firehose, email digest
  - Try it: *[live URL]* · Fork it: *[GitHub URL]*
  - Thank you — questions welcome
- **Visual:** The funnel diagram from Slide 7, now with a fourth stage ghosted in: `ASK`. Plus the two clickable links, large.
- **Speaker notes:** "The end state is a question box over everything you've ever saved: 'What have I read that disagrees with the consensus on AI capex?' The plumbing for that — enriched saved items, an index, a wiki — already exists; the chat UI is the deferred last step. Thank you. The app is live at the link on this slide and the code is public."
- **Evidence:** `sota.md` §5 Phase 3 (deferred: in-app ask-the-KB), §7 open decisions.

---

# PART 2 — FULL WRITTEN REPORT

> If the submitted PDF needs text beyond slides (or if your professor prefers a document), this part is the report. The exported slide PDF alone is acceptable per the brief ("Submit … as a pdf document, with embedded links"); this report can be appended after the slides as an appendix in the same PDF.

## 1. Abstract

Markets Reading is a live, web-based finance research application built with AI assistance (Claude / AI coding tools). It aggregates market research from 22 sources across six formats — Substack newsletters, blogs, YouTube channels, Spotify podcasts, X (Twitter) bookmarks, Value Investors Club ideas, and fund letters from Verde Asset and Michael Mauboussin — into a single chronological timeline that imports each source's recent history on first run and refreshes itself every five minutes thereafter. On top of the feed, the app provides email-style triage (hierarchical folders, theme tags, highlights, bulk actions, cross-device sync), a permanent git-backed knowledge base of saved items enriched with full text and transcripts, a daily LLM-generated morning briefing (global, Brazil, and company news), and an AI-maintained wiki that compiles saved research into linked concept pages. The project responds to Prompt 1 of the FMKT 256 extra-credit assignment ("Build a finance app using Claude or ChatGPT"), under the brief's "projects of other types are welcome" clause, and satisfies its universal constraint: a way of importing historical data and updating when new data becomes available. The application is deployed publicly on Vercel; the full source code is public on GitHub. No login is required to view the submitted content. *[Apply the §BLOCKER fix so this sentence is true of the live link.]*

## 2. The Problem

An investor or student following markets seriously today subscribes to a fragmented stack: several Substack newsletters, a few blogs, YouTube channels, podcasts on Spotify, threads bookmarked on X, and fund letters published as PDFs on asset managers' websites. Each surface must be checked separately; each has its own read/unread state; none of them talk to each other. The practical consequences are (i) missed and duplicated material, (ii) no continuity — a macro argument heard in a podcast is never juxtaposed with the fund letter taking the other side, and (iii) no accumulation — what was read last month is effectively gone. The problem is not a shortage of research; it is the absence of a single place where research arrives, is judged, and is kept.

## 3. The Product

Markets Reading is a four-region web workspace, designed as a quiet parchment-toned "reading room" (EB Garamond, flat paper background, a single vermilion accent) rather than a conventional dashboard:

- **Rail** — Inbox, All, Trash, Sources, Writing, plus the user's hierarchical folders and theme tags.
- **Message list** — the merged timeline (source · title · snippet · arrival date), with search, folder/tag filters, bulk selection and Gmail-style keyboard shortcuts.
- **Reading pane** — the opened item: Substack and in-app writing render inline; YouTube, Spotify, X and PDF items embed or link out cleanly; text selection offers a Highlight action whose quotes are saved and synced.
- **Aside** — an SVG tag map and a Recent Read list for returning to recently opened pieces.

On mobile (≤820px) the workspace collapses to a single-column list→reader drill-down with drawer navigation and History-API back behavior. Core workflows: everything new lands in the Inbox with an automatic *To-read* tag; filing an item to a folder and removing *To-read* saves it permanently to the knowledge base (`kb/inbox/<id>.json`); any one-off article, video or podcast URL can be added from the **＋ Add** popover; and the **Writing** view lets the user author pieces that live in the same inbox/folder/tag system as external content.

## 4. Data: Historical Import and Continuous Updating

The brief's only universal constraint — *"all projects should have a way of importing historical data and updating when new data come available"* — is the app's central engineering concern:

**Historical import.** RSS sources contribute their latest items per feed (capped at 10/feed, 100 total in the live timeline; the cap is a firehose concern only, since saved items persist in the knowledge base). Spotify contributes episodes from the user's saved shows over the last 30 days. X bookmarks are imported from a locally synced archive. Each configured fund contributes its latest letter. At the time of writing, the repository's knowledge base holds 233 saved items (`kb/inbox/*.json`), compiled into 62 wiki source pages across 13 concept folders.

**Continuous updating.** The feed cache refreshes every 5 minutes (`REFRESH_MS` in `lib/feed-cache.js`); the frontend serves the last snapshot instantly, then polls on the same cadence, and the ↻ Sync button forces a live fetch (`?fresh=1`). A Vercel cron (daily, 12:00 UTC / 7 AM ET) and GitHub Actions workflows provide always-on refresh independent of any open browser tab: daily fund-letter scraping into `data/fund-letters-cache.json`, a daily 07:30 (America/Sao_Paulo) LLM briefing, a daily wiki-preparation run, and bookmark syncing. Sources that bot-check datacenter IPs (Value Investors Club) or require personal logins (X) are never scraped from the server; a scheduled agent on the owner's Mac refreshes their caches (`data/vic-cache.json`, `data/bookmarks.json`), and the server reads only the cache. Spotify's strict developer-mode rate limits (HTTP 429 with multi-hour penalties) are handled the same way: a persisted cache plus cooldown, with live API calls only on scheduled refreshes. Data-only commits (workspace, caches, briefings) skip Vercel deploys via `scripts/vercel-ignore.sh`, keeping the free tier within limits.

## 5. The AI Layer

AI participates at three distinct levels, which the deck separates carefully:

1. **AI as builder.** The application — a single-file vanilla-JS frontend (~5,000 lines in `index.html`), Vercel serverless functions in `api/`, and merge/enrichment logic in `lib/` — was designed and written with Claude / AI coding assistants, per the prompt's premise. No framework or build step is used, by design.
2. **AI as analyst.** A scheduled workflow gathers headlines (Google News RSS: global business/world, Brazil, per-company queries for Nvidia, Viridis Mining, Motiva and Ecorodovias, and a rotating topic — currently "Chinese AI open models") and an LLM (Claude via OpenRouter, `lib/briefing-llm.js`) synthesizes a short, sectioned morning briefing stored in `data/briefings.json`.
3. **AI as librarian.** Saved items are enriched on save (X thread text via FxTwitter; YouTube transcripts via `youtube-transcript`) and compiled into a Markdown wiki under `kb/wiki/` — source pages, concept pages (e.g. *AI (markets)*, *Macro*, *LS*), entity pages, an index, and a *tensions* page surfacing disagreements. When an Anthropic API key is configured, an LLM pass (`lib/wiki-llm.js`) adds a factual summary, up to five key claims and up to three tensions per source, constrained to the source text with JSON-only output. Because the entire library is plain text in git, it is directly queryable by LLM tools — the intended query engine for the "ask your library" roadmap.

## 6. Relevance to Finance

The app addresses the *research process* rather than security selection: coverage (not missing a Verde letter, a VIC idea, or a Citrini piece), triage (spending judgment where it matters), and institutional memory (a queryable record of what was read and highlighted). These are the upstream activities on which long/short decisions, screening criteria and scenario thinking depend. Its source mix is deliberately investment-grade: hedge-fund-adjacent newsletters (Citrini, Rebound Capital, HF Best Ideas), practitioner macro (Jordi Visser, Ray Dalio), primary fund letters (Verde Asset's Brazilian funds), idea generation (Value Investors Club), and canonical investor writing (Mauboussin, Paul Graham). It makes no return claims and issues no buy/sell signals; that boundary is stated on Slide 13.

## 7. Repeatability and Extensibility

Per the brief's extra-value criterion, the system repeats with new inputs without additional coding: new RSS sources are a single entry in the `BASE_SOURCES` array in `api/feed.js`; new fund letters are a single JSON object in `data/fund-letters-config.json` (`name`, `mode` — `listing | rss | static | verde | mauboussin` — and fund identifiers); new briefing companies/topics are edits to `data/briefing-config.json`; one-off items are added from inside the UI. A classmate could fork the repository, substitute their own sources and funds, and have a personalized instance running the same day.

## 8. Limitations and Risks

(i) The app is not a screener, simulator or trading game, and produces no backtests or performance metrics. (ii) The live firehose is intentionally capped; permanence applies to saved items. (iii) Third-party dependencies are fragile in known ways — Spotify rate limits, expiring X/VIC sessions, RSS feeds moving — mitigated by persisted caches and local sync agents rather than eliminated. (iv) LLM-generated summaries and briefings can misstate facts; prompts are constrained to retrieved source text, outputs are structured, and every wiki/briefing entry retains links to originals for verification. (v) Write features (workspace sync, saving, writing) are protected by a shared device secret (`SAVE_SECRET`) because the library is personal; reading the submitted demo must remain login-free (see the blocker note at the top of this file).

## 9. Roadmap

Shipped: firehose, triage, git-backed library with enrichment, daily AI briefing, AI-maintained wiki. Next, in order: (1) in-app "Ask the KB" — retrieval-augmented chat over saved items (UI scaffold exists, currently hidden); (2) LLM auto-tagging of the entire firehose by theme (folders/tags are currently manual); (3) an email digest of unread items. Open design questions (tag everything vs. saved-only; where the enrichment runner lives) are recorded in `sota.md` §7.

## 10. Conclusion

Markets Reading demonstrates Prompt 1 end-to-end: a real finance application, built with AI, deployed publicly, importing historical data and updating itself continuously, and designed so that new sources, funds and topics require configuration rather than code. Its contribution is a working research funnel — Firehose → Triage → Library — that turns fragmented market reading into a permanent, AI-queryable knowledge base.

## 11. Team Contributions *(fill in — graders look for this)*

| Member | Owned |
|---|---|
| `[NAME 1]` | `[e.g. Product concept, source curation, fund-letter adapters]` |
| `[NAME 2]` | `[e.g. Frontend workspace, mobile layout, design system]` |
| `[NAME 3]` | `[e.g. Feed aggregation, Spotify/X/VIC sync, deployment]` |
| `[NAME 4]` | `[e.g. Briefing + wiki AI layer, testing, this report/slides]` |

> If this was substantially one person's prior project, say so honestly here and state what each team member added *for this assignment* (sources, briefing topics, wiki, testing, documentation). Do not claim work that did not happen.

---

# PART 3 — APPENDICES

## Appendix A — Architecture & File Map

```
Browser ── index.html (single-file vanilla JS app, ~5,000 lines)
   │  GET /api/feed · PUT /api/workspace · POST /api/save · /api/writing · /api/manual-link
Vercel serverless ── api/*.js handlers, lib/*.js merge/enrichment logic
   │  reads/writes (GitHub Contents API in production, filesystem locally)
Git repo = database ── data/*.json (workspace, caches, writings, bookmarks)
                       kb/inbox/<id>.json (saved items) · kb/wiki/*.md (compiled wiki)
Schedulers ── GitHub Actions (feed refresh, fund letters, briefing, wiki, bookmarks)
              Vercel Cron (daily 12:00 UTC) · Mac LaunchAgent (VIC + X, login-walled sources)
```

Key files: `index.html` (UI) · `api/feed.js` (`BASE_SOURCES`) · `lib/aggregate.js` (merge) · `lib/spotify.js` · `lib/fund-letters.js` · `lib/vic.js` · `lib/kb-enrich.js` · `lib/briefing-gather.js` + `lib/briefing-llm.js` · `lib/wiki-*.js` · `scripts/vercel-ignore.sh` (skip deploys on data-only commits). Item identity is a stable SHA-256 of the item URL (`lib/item-id.js`).

## Appendix B — Source Inventory (as in `api/feed.js` + fund config)

Newsletters/Substack: Jordi Visser, ARK Next Gen Internet, Rebound Capital, Citrini Research, Ray Dalio, Works in Progress, Wizard's Winners, Bristlemoon Capital, Philipp Haas, Indra's Thoughts, Casteleyn Partnership, TacticzHazel, HF Best Ideas, Hated Moats. Blogs: Gregory Blotnick, Kyle Samani, Paul Graham (community RSS). YouTube: Jordi Visser Labs. Dynamic: Value Investors Club (Investing), Spotify Podcasts, X Bookmarks, Saved Links, Writing, Letters (Verde Multimercado Brasil, Verde Ações Mundi, Verde Ações Mundi BRL, Verde Ações Brasil — monthly letters via Verde's public JSON — and Michael Mauboussin, latest piece only). Categories: Substack · YouTube · Blog · Macro/Official · Spotify · Bookmarks · Investing · Writing · Letters · Briefing.

## Appendix C — Update Cadence

| Job | Cadence | Mechanism |
|---|---|---|
| Feed refresh | Every 5 min | Edge cache + client poll + external cron warming |
| Morning cron | Daily 12:00 UTC (7 AM ET) | Vercel Cron → `/api/cron` |
| Fund letters | Daily | GitHub Action `sync-fund-letters.yml` → cache |
| Daily briefing | Daily 07:30 São Paulo | GitHub Action `briefing-daily.yml` → `data/briefings.json` |
| Wiki preparation | Daily 08:00 São Paulo | GitHub Action `wiki-daily.yml` → queue + run sheet |
| VIC ideas | Login, 08:15, 20:15, ≥ every 12h | Mac LaunchAgent → `data/vic-cache.json` |
| X bookmarks | ~Hourly (rate-limited) | Local birdclaw sync → `data/bookmarks.json` |
| Workspace sync | Every 5 min + on Sync/tab-close | `GET/PUT /api/workspace` → `data/workspace.json` |

## Appendix D — Tech Stack

Vanilla HTML/CSS/JS frontend (no build step) · Node.js Vercel serverless functions · `rss-parser`, `sanitize-html`, `youtube-transcript`, `puppeteer-core` · Spotify Web API · birdclaw (X bookmarks) · GitHub Contents API for production persistence · Anthropic Claude (wiki enrichment) and Claude via OpenRouter (briefing) · Deployed on Vercel (Hobby), automation on GitHub Actions.

## Appendix E — Fact Sheet (verified from repo, Oct 2026 — do not alter without re-checking)

- 22 named entries in `api/feed.js` (incl. dynamic sources); fund letters add 5 configured funds (4 Verde + Mauboussin).
- Knowledge base: 233 files in `kb/inbox/`; wiki: 62 source pages, 13 concept pages, 4 entity pages.
- Repo data snapshots at writing: 145 X bookmarks, 28 manual links, 12 in-app writings, 56 cached Spotify episodes.
- Refresh: 5 minutes (`REFRESH_MS = 5 * 60 * 1000`); feed cap 10 items/feed, 100 total (live timeline only).
- Live URL (graded): https://markets-signals.vercel.app — open in incognito; Must-Read hero, no login. Repo/branch: https://github.com/lucas-rivelli/markets-dashboard/tree/fmkt256-signals
- **Never claim:** returns, Sharpe ratios, user counts, accuracy percentages, or "real-time" (it is 5-minute; say "every 5 minutes").

## §7 Screenshot Shot List (take these, name files `shot-1.png` … `shot-6.png`)

1. **Desktop hero** — app open on an interesting article, all four regions visible, a few unread marks in the list. (Slide 3)
2. **Reader close-up** — an opened Substack/writing piece with a highlight visible. (Slides 6/9)
3. **Add-link popover** — `＋ Add` open with a URL pasted. (Slide 6)
4. **Sources launchpad** — Sources view grouped by category. (Slide 8)
5. **Tag map + Recent Read** — right column close-up; ideally after tagging a few items so the map has nodes. (Slide 9)
6. **Wiki overview** — `kb/wiki/overview.md` rendered (Obsidian/GitHub preview) or the Briefing item in the feed. (Slide 10)
7. *(Optional)* **Phone view** — mobile list→reader, for an "also works on phone" inset. (Slide 3 or 6)

Take screenshots at full window size with real content (no empty states, no password gate visible). Redact nothing — there is no private data in the reading UI — but do not screenshot `.env` files or tokens.

## §9 Pre-Submission Checklist

- [ ] Team names (3–4) filled in §FILL-IN, Slide 1, and §11 contributions — honestly.
- [ ] **Demo link opens with no login/password in an incognito window** (blocker fix done and tested).
- [ ] PDF exported from the slides; every link in it clicked once from the PDF itself.
- [ ] All numbers match Appendix E; no invented metrics anywhere.
- [ ] Screenshots are real app captures, not mockups; no empty-state shots.
- [ ] Filename: `FMKT256_ExtraCredit_[TeamNames].pdf`; submitted on Canvas **before Nov 3, 1:00 PM**.
- [ ] (Optional but recommended) Append Part 2 as report pages after the slides in the same PDF.

---

*Sources for verification: assignment PDF (AI_Extra_Credit.pdf, FMKT 256 Fall 2026, Prof. Egger lecture follow-up); repo files `sota.md`, `Claude.md`, `HANDOFF.md`, `project.md`, `api/feed.js`, `data/fund-letters-config.json`, `data/briefing-config.json`, `lib/feed-cache.js`, `.github/workflows/`, `vercel.json`.*
