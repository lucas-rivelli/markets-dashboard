# Gregory Blotnick (@gregoryblotnick) — X archive

Personal offline archive. **Not wired into the markets dashboard.**

## Source of truth

Tweets are fetched with the same stack as bookmark sync:

- `npx bird user-tweets / search / read / thread`
- GitHub Actions secrets `AUTH_TOKEN` + `CT0`

No website scrape, no reconstruction, no invented posts.

## Layout

```
archive/gregoryblotnick/
  tweets/
    manifest.json
    all.json
    by-id/*.json
  book/
    markets-ls-pitches.md         ← master doc (L/S, markets, pitches)
    markets-ls-pitches.index.json
```

## Commands

```bash
npm run archive:blotnick   # needs AUTH_TOKEN + CT0 (or Actions workflow)
npm run book:blotnick      # rebuild markets book from tweets/all.json
```

## Coverage note

X only returns what the live API still serves. First successful pull: **809** posts from the current profile-timeline window (~Mar–Aug 2026). Older posts may still be fillable later via search / bookmark-id reads when rate limits cool. The markets book is built only from those real posts.
