# Markets Reading: Signals — Setup & Reference

A ticker signal screener built for FMKT 256 (Prompt 1: build a finance app with AI).
An LLM reads every incoming public research item, extracts which US stocks it discusses and the author's stance toward each, combines that with daily price history, flags Long/Short/Watch candidates by explicit rules, and alerts when a rule fires.

**Branch:** `fmkt256-signals` (never merged to `main` as-is — see "Merging" below).
**Page:** `signals.html` · **API:** `GET /api/signals`, `POST /api/signals/refresh`
**Data:** `data/signals/` (config, extractions, prices, alerts, state, track record)

---

## 1. Deploy the separate Vercel project (dashboard steps)

The signals app is a **second Vercel project** pointing at the same repo, so the personal app is untouched.

1. Vercel → **Add New → Project** → import `lucas-rivelli/markets-dashboard`.
2. Project name: e.g. `markets-signals`.
3. **Root Directory:** leave at repo root. Framework Preset: **Other**. No build command, no output directory (static + `api/` functions, same as the main app).
4. **Production Branch:** Settings → Git → Production Branch → `fmkt256-signals`.
   (This branch's `vercel.json` contains `"/" → "/signals.html"` rewrite, so the project root *is* the screener. The main app stays at `/index.html`.)
5. **Environment Variables** (Production):
   | Variable | Required | Purpose |
   |---|---|---|
   | `GITHUB_DISPATCH_TOKEN` | for Refresh button | Fine-grained token with Actions: write on this repo |
   | `SIGNALS_DATA_BRANCH` | no (default `fmkt256-signals`) | Branch `/api/signals` reads fresh JSON from |
   | `SIGNALS_BRANCH` | no (default `fmkt256-signals`) | Branch the refresh workflow dispatches on |
   | `NTFY_TOPIC` | no | Lets the API link the public alert topic if state has none |
   | `SIGNALS_PUBLIC_URL` | no | This project's URL, used in alert links |
6. Deploy. Open the URL in an **incognito window**: no login, no password, no cookies — by construction the page and API expose only public headlines, extraction metadata, prices and alerts. X bookmarks, VIC, Spotify, workspace/triage data are never read by any signals code.
7. Disable Deployment Protection for this project (Settings → Deployment Protection → off for Production), otherwise graders hit a Vercel login wall — the assignment penalises that.

### GitHub Actions secrets (repo Settings → Secrets and variables → Actions)
| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | LLM extraction in the 30-min refresh (or `OPENROUTER_API_KEY`) |
| `NTFY_TOPIC` | Public alert topic, e.g. `markets-reading-signals-<random>` — anyone can subscribe at `https://ntfy.sh/<topic>`, pick a hard-to-guess name |
| `FMP_API_KEY` | Optional price fallback |
| Variable `SIGNALS_PUBLIC_URL` | Deployment URL for alert links |

The workflow `.github/workflows/signals-refresh.yml` runs every 30 minutes on `fmkt256-signals`, commits `data/signals/` back, and those commits **skip Vercel builds** (`data/signals/*` in `scripts/vercel-ignore.sh`). Freshness without redeploys: `/api/signals` reads the newest committed JSON from `raw.githubusercontent.com` in production.

> ⚠️ **GitHub limitation — one action required (verified Oct 20, 2026).** Scheduled and API-dispatched workflows only run when the workflow file exists on the repo's **default branch**. `gh workflow run signals-refresh.yml --ref fmkt256-signals` returns *"not found on the default branch"*. So until you choose one of these, `state.json` will **not** advance on its own and Refresh-now will 404:
> 1. **Recommended:** merge *only* `.github/workflows/signals-refresh.yml` to `main` (a one-file PR). The workflow explicitly checks out and pushes to `fmkt256-signals`; no app code on `main` changes, and the personal app is unaffected. (This was deliberately **not** done for you — the ground rule was "never commit to `main`" — so it needs your explicit go.)
> 2. Change the repo default branch to `fmkt256-signals` (not recommended — affects the personal app's automations).
> 3. Run `node scripts/signals-refresh.mjs` from any always-on machine (e.g. the Mac LaunchAgent pattern used for VIC) and push.

## 2. Run locally

```bash
npm run dev                       # http://localhost:3000/signals.html (main app at /)
node scripts/signals-fetch-sources.mjs     # per-source item counts
node scripts/signals-prices.mjs NVDA AAPL SPY   # price backfill/update for tickers
node scripts/test-signals.mjs              # compute-engine unit tests
node scripts/signals-backfill.mjs          # ONE-OFF: 2y prices + extract everything
node scripts/signals-refresh.mjs           # incremental refresh (what cron runs)
node scripts/signals-test-alert.mjs NVDA   # forced TEST alert -> alerts.json + ntfy
```

Local LLM key: `.env.local` with `ANTHROPIC_API_KEY=…` **or** the existing `OPEN_ROUTER_KEY` (extraction falls back to OpenRouter → Claude automatically; production prefers Anthropic direct).

## 3. Configuration — repeatability without code (`data/signals/config.json`)

This file is the **only** thing anyone edits to change behaviour:

- **Add a ticker:** append `"XYZ"` to `universe`. Next run fetches its Yahoo news feed, its 2y price history, extracts mentions, and it appears in the table. No code change (verified acceptance criterion).
- **Remove a ticker:** delete it from `universe` (its cached prices/extractions remain harmlessly on disk).
- **Add a source:** append `{ "name": "My Blog", "rss": "https://…/feed", "sourceType": "Blog" }` to `extraSources` — or add a normal RSS source to `api/feed.js` `BASE_SOURCES` with a public category (`Substack | Blog | YouTube | Macro/Official`) and it is picked up automatically. `dynamic`/login sources are always excluded.
- **Change thresholds:** edit `rules.mentionSpike / sentimentShift / divergence`, `windows`, `minConfidence`, `discoverMinMentions`. The page's what-if sliders mirror these live without saving.
- **Change the AI:** `llm.model` (default `claude-haiku-5-5`), `llm.maxItemsPerRun` (cost cap per scheduled run), `llm.maxCharsPerItem`.
- **Tune Must-Read:** `readingQueue.maxItems / windowDays / flagWeights / sourceWeights` — how the "most important research today" ranking weighs flags vs source depth.

### Must-Read — the differentiator

Screeners flag tickers; Signals tells you **what to read**. `lib/signals/reading-queue.js` (pure, shared by server and browser) ranks individual items from the last 7 days by: flagged ticker (LONG/SHORT > WATCH), sentiment-shift size, mention-spike strength, divergence, the item's own sentiment x confidence, source depth (long-form research above headline-only news), and recency decay — with a small bonus for discovered names. Every ranked item carries up to three plain-language reason chips ("CEG: Short candidate", "sentiment shift -0.38", "7 mentions this week (3.5x baseline)"). It costs nothing extra: scoring reuses extractions and screener rows, no LLM calls. The queue sits above the screener table, re-ranks live when the what-if sliders move, and items can be marked read (fades, stored only in the visitor's browser). Ticker detail adds a Bull case / Bear case split of the LLM's rationales, and a "Since last run" strip reuses the day's new alert firings.

## 4. How it works

```
Public RSS (18 feeds from api/feed.js) ─┐
Yahoo Finance per-ticker news RSS (20) ─┼─> fetch + normalise {id=SHA256(url), source, title, url, date, text}
                                        │        lib/signals/sources.js
                                        v
                              LLM extraction (once per item, ever)
                              lib/signals/prompt.js + extract.js
                              -> {ticker, company, sentiment -1..+1, confidence, stance, rationale<=25w}
                              -> data/signals/extractions.json (headline + mentions only, no article text)
Prices: Nasdaq API -> Yahoo (backoff) -> Stooq -> FMP     lib/signals/prices.js
        2y backfill, then missing-days only -> data/signals/prices/<T>.json
                                        v
                              computeSignals(extractions, prices, config, asOf)   lib/signals/compute.js
                              (pure, UMD — the browser re-runs it for the sliders)
                                        v
              rows (flag, rules, metrics, score) -> alerts diff -> ntfy + alerts.json
                                        v
              state.json + track-record.json -> GET /api/signals -> signals.html
```

**Rules** (windows: recent `R=7d`, baseline `B=30d`; sentiment = confidence-weighted mean; baseline rate scaled `mentions_B × R/B`):
- `MENTION_SPIKE` → **Watch**: mentions ≥ `minMentions` and spike ratio ≥ `minRatio`
- `BULLISH_SHIFT` / `BEARISH_SHIFT` → **Long/Short**: sentiment shift vs baseline ≥ `minAbsShift` with ≥ `minMentions`
- `DIVERGENCE_LONG` / `DIVERGENCE_SHORT` → **Long/Short**: sentiment ≥ `minAbsSentiment` one way, excess return vs SPY ≥ `minAbsExcessReturn` the other way
- Ranking score: `sentRecent × log(1 + mentionsRecent)`. Discovery: non-universe tickers with ≥ `discoverMinMentions` mentions get rows (prices follow next run).

**Alerts:** deduped by `ticker+rule+date`; new firings post to `https://ntfy.sh/<NTFY_TOPIC>` (title e.g. `LONG candidate: NVDA (bullish shift)`), appear in the Alerts panel, and trigger a browser Notification if the user opted in. `scripts/signals-test-alert.mjs` forces a labelled TEST alert for demos.

**Track record:** daily replay over price history using only that day's extractions (edge-triggered events), forward 5/20-trading-day excess returns vs SPY, summarised per rule/flag. Labelled on the page as a small-sample in-sample check — mention history only exists where feeds published (~recent weeks), so event counts are small. Not a tradable-strategy backtest.

## 5. Providers — what was actually verified (Oct 20, 2026)

- **Yahoo Finance RSS** per ticker: works, 12–20 items/ticker.
- **Nasdaq API** (prices): free, key-less, full 500-bar/2y history reliably. **Primary.**
- **Yahoo Finance chart API**: works in single requests but HTTP 429 under burst traffic. Fallback with exponential backoff.
- **Stooq CSV**: returns a JavaScript anti-bot challenge page, not CSV. Implemented (detects + throws), never relied on. *This is why Nasdaq is primary.*
- **FMP**: keyed fallback (`FMP_API_KEY`) if datacenter IPs get throttled in Actions.

## 6. Costs (estimated)

LLM is the only metered piece, and each item is extracted **once, ever** (persisted in `extractions.json`).
At Haiku-class pricing, an average item is ~100–1,200 input tokens (headline-only news ≈ 150; a truncated Substack post ≈ 1,100) + ~120 output tokens — roughly **$0.0003–$0.002 per item**. A 30-minute refresh extracting the `maxItemsPerRun: 80` cap therefore costs on the order of **a few cents worst-case**; a typical run with 5–20 new items is well under a cent. The one-off backfill (~450 items) is on the order of **$0.25–$1**. Prices, RSS, GitHub Actions (public repo) and ntfy.sh are free. *Estimates — check current Anthropic pricing before quoting.*

## 7. Files

```
signals.html                     the page (Chart.js 4.4.3 via cdnjs, EB Garamond, manuscript style)
lib/signals/config.js            config loader/validator
lib/signals/sources.js           public-source crawling + normalisation
lib/signals/prompt.js            the extraction prompt (quote this in the write-up)
lib/signals/extract.js           LLM calls, JSON validation/retry, never-pay-twice store
lib/signals/prices.js            provider interface + 2y/incremental price store
lib/signals/compute.js           pure signal engine (Node + browser)
lib/signals/reading-queue.js     pure Must-Read importance ranking (Node + browser)
lib/signals/alerts.js            alerts store + ntfy
lib/signals/track-record.js      daily replay, forward excess returns
lib/signals/pipeline.js          fetch -> extract -> prices -> compute -> alerts -> state
lib/signals/data.js              payload builder for the API (raw-GitHub in prod)
api/signals/index.js             GET /api/signals
api/signals/refresh.js           POST /api/signals/refresh (dispatches Action, 5-min rate limit)
scripts/signals-*.mjs            fetch-sources / prices / extract / backfill / refresh / test-alert
scripts/test-signals.mjs         compute unit tests (plain assertions)
data/signals/config.json         THE config (universe, rules, thresholds)
data/signals/extractions.json    one record per item ever extracted
data/signals/prices/<T>.json     daily closes per ticker + SPY
data/signals/alerts.json         alert history
data/signals/state.json          last run: status, counts, rows
data/signals/track-record.json   replay summary
.github/workflows/signals-refresh.yml   every 30 min
```

**Existing files touched on this branch (and why):** `vercel.json` (root→signals rewrite *for the separate project only* + function durations), `scripts/vercel-ignore.sh` (`data/signals/*` added to the data-only skip list), `.env.example` (signals env documented — it was already modified in the working tree), `scripts/dev.js` (two routes so `npm run dev` serves `/api/signals` locally). `index.html`, all `api/*.js`, `lib/*.js` outside `lib/signals/`, personal `data/` files and `kb/` are **untouched**.

## 8. Merging warning

Do **not** merge `fmkt256-signals` into `main` wholesale: the `vercel.json` `"/"` rewrite would point the personal app's root at the screener. If the screener is ever wanted on the main deployment, drop the rewrite and keep `signals.html` at `/signals.html`.

## 9. Limitations

Sentiment is one LLM's reading and can conflate news tone with author stance (watch headline-only items); mention history is only as deep as RSS feeds reach, so baseline windows and the track record are thin; free price endpoints may throttle datacenter IPs (FMP fallback exists); the screener produces research candidates, not investment advice.
