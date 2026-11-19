# Lorekeeper

A research-grounded content studio for educational creators. It learns your brand, researches your niche with live web search, and turns what it finds into original ideas, with every claim checked against the sources the search actually returned.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The whole interface: brand profile, research ideas, remix with credit, decision log, how it works |
| `api/ideas.js` | Server function: profile + past posts → web research → ideas with sourced claims |
| `api/remix.js` | Server function: a reference post → transferable structure, what not to copy, an original idea, a credit line |
| `api/_lib.js` | Shared code: Claude API call with web search, and the source check |
| `vercel.json` | Gives each function up to 300 seconds to run |

## Deploy (about 10 minutes, free hosting)

1. **Get an API key.** Go to console.anthropic.com, add US$5 credit, then go to *Limits* and set a monthly spend limit (e.g. US$10). Create an API key and copy it somewhere safe. Never paste it into a chat or a file in this repo.
2. **Put the code on GitHub.** Create a new repository called `lorekeeper` and upload every file in this folder (keep the `api` folder structure).
3. **Deploy on Vercel.** Sign in to vercel.com with GitHub → *Add New → Project* → import `lorekeeper` → leave every setting at its default.
4. **Add the key.** Before clicking Deploy, open *Environment Variables* and add:
   - `ANTHROPIC_API_KEY` = your key
5. **Deploy.** Vercel gives you a public URL like `lorekeeper-yourname.vercel.app`. That is the link for your reference list and slides.

### Optional settings (environment variables)

- `CLAUDE_MODEL`: defaults to `claude-sonnet-5-5`. Change it if you want a different model.
- `RATE_LIMIT_PER_HOUR`: defaults to 20 requests per visitor per hour, to protect your credit on a public link.

## Cost

Each research run uses up to 6 web searches (US$10 per 1,000 searches) plus tokens. Expect a few cents per run. US$5 covers building, testing, the demo and marking.

## The safeguards (for the write-up)

- **Source check.** The server compares every URL the model cites against the URLs the web search actually returned. Each claim is badged *Source retrieved*, *Source not retrieved* (possible fabrication) or *Unsourced*.
- **Research trail.** Every run shows the exact searches made and the sources returned.
- **Accuracy risk.** Each idea names its main risk of oversimplifying or misrepresenting the research.
- **Remix with credit.** Separates transferable structure from what belongs to the original creator, rates similarity risk and writes a credit line.
- **No scraping.** No social account connection. The creator chooses what data to share by pasting it in.
- **Local-only storage.** The profile and decision log stay in the user's browser.
- **Human decision log.** Every idea is kept or rejected by the creator with a reason, and the log exports to CSV.
