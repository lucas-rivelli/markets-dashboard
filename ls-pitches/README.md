# L/S pitches — Gregory Blotnick

Standalone personal project (not part of markets-dashboard).

## Book
- `Gregory Blotnick — Markets L-S Pitches.md` — markets / L/S / pitches only (original posts, ordered)

## Full archive
- `gregory-blotnick/tweets/all.json`
- `gregory-blotnick/tweets/by-id/`

## Refresh (optional)
Needs the same X cookies as bookmark sync (`AUTH_TOKEN` + `CT0`):

```bash
AUTH_TOKEN=… CT0=… node scripts/archive-user-tweets.js gregoryblotnick
node scripts/build-blotnick-markets-book.js gregoryblotnick
```
