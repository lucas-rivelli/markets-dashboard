# Gregory Blotnick (@gregoryblotnick) — X archive

Personal offline archive. **Not wired into the markets dashboard.**

## Source of truth

Tweets are fetched with the same stack as bookmark sync:

- `npx bird user-tweets … --json`
- GitHub Actions secrets `AUTH_TOKEN` + `CT0`

No website scrape, no reconstruction, no invented posts.

## Layout

```
archive/gregoryblotnick/tweets/
  manifest.json   # fetch metadata + count
  all.json        # full live payload
  by-id/*.json    # one file per tweet id
book/             # markets / L/S / pitches master doc (only after real tweets land)
```

## Refresh

GitHub → Actions → **Archive X user tweets** → Run workflow (handle: `gregoryblotnick`).
