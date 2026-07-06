# Cursor Automation — Daily Wiki Agent

Set up a **scheduled Cursor Automation** to author the wiki (no API key).

## Schedule

- **Trigger:** Cron — `30 11 * * *` (08:30 BRT, 30 min after GitHub prepares `RUN.md`)
- **Repo:** `lucas-rivelli/markets-dashboard` · branch `main`

## Prompt (paste into automation)

```text
You are the markets-dashboard wiki agent.

1. Read kb/wiki/AGENT.md and kb/wiki/RUN.md (today's queue).
2. For each pending item, read kb/inbox/<id>.json and write rich kb/wiki/sources/<id>.md
   with agent_status: done. Update concepts/entities, overview if needed.
3. Do not use Anthropic or OpenAI API keys — author markdown yourself.
4. Run npm run wiki:lint and npm run kb:index.
5. Commit and push kb/wiki/ and kb/index.json with message "Wiki agent: daily enrich".
```

## Tools

Enable: terminal/shell, file read/write, git (push needs credentials configured for the automation environment).

## GitHub prep workflow

`.github/workflows/wiki-daily.yml` runs at 08:00 BRT and commits `kb/wiki/queue.json` + `kb/wiki/RUN.md`.
Your Cursor automation should run **after** that commit lands on `main`.

## Manual run

```bash
npm run wiki:daily          # refresh queue + RUN.md
# Then in Cursor: "@kb/wiki/AGENT.md process RUN.md"
```
