# Lorekeeper

A research-grounded content studio for educational creators. It learns your brand, researches your niche with live web search, and turns what it finds into original ideas, with every claim checked against the sources the search actually returned.

Built for the AI Strategy & Implementation Pitch. See `BUILD_LOG.md` for the full record of every decision and change.

## What it does

| Page | What it does |
|---|---|
| Studio | Setup steps, your page at a glance (median views, save rate, strongest format, all computed in your browser), and your content pipeline |
| Brand | Niche, audience, voice, pillars, boundaries and your pasted post data, with a live table of your posts |
| Research ideas | Analyses your posts, searches your niche live, pitches ideas with sourced claims, an accuracy risk and a craft tip |
| Remix with credit | Separates a post's borrowable structure from what belongs to its creator, builds an original idea, rates similarity and writes a credit line |
| Content plan | Kept ideas move through Shortlisted, Scripting, Filmed and Posted, with dates and script notes |
| Scripts | Draft for me (AI drafts, you refine) or Coach me (you write, AI gives feedback only); your voice or structure inspired by a credited creator; instant checks for speaking time, hook length and figures not in your sources; version history labelled by author |
| Decisions | Every keep or reject with your reason, filterable and exportable |
| How it works | The pipeline, what each source label means, and where human judgement stays essential |

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `assets/styles.css` | Design system (marble and verdigris; Spectral and Hanken Grotesk) |
| `assets/app.js` | Interface logic, local storage, the live research trail, content plan board |
| `api/_lib.js` | Streams Claude's web search, rebuilds results, runs the source check |
| `api/ideas.js` | Research and idea generation |
| `api/remix.js` | Remix with credit |
| `api/script.js` | Script drafting, refining and coaching (no web search: scripts use only the idea's checked claims) |
| `api/health.js` | Reports whether the research engine is connected (no credit used) |
| `dev/` | Local preview server, a fake Claude API, and automated tests. Not deployed. |

## Deploy on Vercel

1. In the Anthropic Console: add credit, set a monthly spend limit, create an API key.
2. On vercel.com: *Add New → Project* → import `lorekeeper` → leave settings at their defaults.
3. Under *Environment Variables* add `ANTHROPIC_API_KEY` with your key. Never put the key in a file in this repository.
4. Deploy. The URL Vercel gives you is the public prototype link.

Every push to `main` redeploys automatically.

### Optional environment variables

- `CLAUDE_MODEL`: defaults to `claude-sonnet-5-5`.
- `RATE_LIMIT_PER_HOUR`: defaults to 20 research runs per visitor per hour.

## Run locally without spending credit

```
node dev/server.mjs        # preview on http://localhost:4321 with a fake Claude API
node dev/test-api.mjs      # server tests
python3 dev/test-ui.py     # full interface test in a headless browser (needs Playwright)
```

## The safeguards

- **Source check.** The server compares every URL the model cites with the URLs the web search actually returned. Each claim is labelled *Found in search*, *Not found in search* (possibly fabricated) or *No source*.
- **Live research trail.** Every search and every source appears as it happens, and is kept with the result.
- **Accuracy risk.** Each idea names how it could misrepresent the research.
- **Remix with credit.** Structure is separated from the original creator's content; similarity is rated; a credit line is written.
- **No scraping.** No social account connection. The creator chooses what data to share.
- **Local-only storage.** Profile, plan and decisions stay in the user's browser.
- **Human decisions.** Nothing enters the plan unless the creator keeps it, and every rejection records a reason.
