# Lorekeeper build log

A running record of every decision, build step, change and test on Lorekeeper. It is the source material for the Implementation Plan in Part A of the AI Strategy & Implementation Pitch.

**How entries work**
- Times are Australia/Brisbane (AEST).
- **Who** is *Will* (decisions and edits Will made) or *Claude* (work Claude did at Will's direction).
- **Type** is one of: Decision, Research, Build, Change, Test, Deploy, Edit (a change Will made himself).
- Every code change is also a Git commit, so `git log` on GitHub shows exactly what changed in each step.
- If you edit anything yourself (on GitHub, in Vercel, anywhere), tell Claude what and why and it gets logged here. Claude also checks the Git history for edits before each session's work.

---

## 5 November 2026: ideation

**12:07 · Decision · Will**
Proposed the idea: a personalised content-creation workspace that knows a creator's account, past performance and goals, researches their niche and similar creators, and helps them plan content, generate ideas and build skills.
*Why:* Will's own pain point as a philosophy creator. He was already doing this manually with Claude (own ideas + web research + putting his own spin on other creators' work).

**12:10 · Research · Claude**
Read the assessment brief and the pitch rubric. Weightings: Problem framing 20%, Prototype functionality and demonstration 30%, Ethical and reflective insight 30%, Delivery 20%. Requirements: working prototype, live demo, public link.

**12:12 · Research · Claude**
Market check. Found close competitors: Creafico (competitor tracking that turns viral videos into personalised ideas), Pattern.io (AI content strategist for short-form creators), Iconosquare, Idea Engine, VidIQ, OutlierKit, and a US$17 n8n competitor-scraping workflow.

**12:13 · Research · Claude**
Data-access check. Instagram's official API gives a creator their own insights, but not other creators' post-level data. Competitor scraping breaches Meta's terms.

**12:15 · Decision · Will + Claude**
Assessment verdict: viable for the assessment. Novelty is not marked; the ethics section (30%) is unusually strong for this idea (attribution vs copying, hallucinated sources in a psychology niche, homogenisation, creative agency). Business viability judged weak as framed because the market is crowded and general AI assistants already do much of this.

## 19 November 2026: scoping, tooling, v1 and v2

**11:10 · Decision · Will + Claude**
Confirmed the idea despite Creafico. *Why:* the rubric marks a working, responsible implementation, not originality. Creafico becomes market validation in Part A and a contrast for the ethics argument (it optimises for virality; Lorekeeper optimises for credibility and originality).
Positioning locked: *a research-grounded content studio for educational creators that generates on-brand ideas backed by checkable sources, and adapts other creators' structures without copying their content.*

**11:10 · Decision · Will + Claude**
Scope locked to three features: (1) brand profile with uploaded post history, (2) research engine returning sourced ideas with unverified claims flagged, (3) remix with attribution. Excluded: live Instagram integration (API limits, terms of service), content calendar and skills coaching as separate modules (deferred to future work).

**11:16 · Decision · Will + Claude**
Build method: Claude Code (in the Claude app) writing a small web app, hosted free on Vercel, calling the Claude API with its web search tool.
*Alternatives rejected:*
- Base44: free plan capped at 25 message credits a month (5 a day) plus 100 integration credits, too tight to build and demo on; less control over the safeguards.
- Higgsfield: generates images and video, which is not the app's job; scope creep.
- Gemini free API: search grounding is not reliably available on the free tier; risky for a graded live demo.
*Cost:* about US$5 of Claude API credit (web search is US$10 per 1,000 searches plus tokens).

**11:18–11:24 · Build · Claude** (v1 prototype)
- `api/_lib.js`: Claude API call with the web search tool, handling of paused long searches (`pause_turn`), JSON extraction.
- **Source check safeguard:** every URL the model cites is compared with the URLs the web search actually returned. Claims are labelled *Source retrieved*, *Source not retrieved* (possible fabrication) or *Unsourced*.
- `api/ideas.js`: system prompt requiring research first, no fabrication, performance insights from the creator's own posts, brand fit, an accuracy risk and a craft tip per idea.
- `api/remix.js`: separates transferable structure from what belongs to the original creator, builds one original idea, writes a credit line, rates similarity risk.
- `index.html`: brand profile (saved in the browser only), research ideas, remix, decision log (keep or reject each idea with a reason, CSV export), how-it-works page.
- Basic rate limit per visitor to protect API credit on a public link.

**11:23 · Test · Claude**
- Simulated Claude API (including a paused search) through both server functions: passed. A planted fake source was correctly flagged *Source not retrieved*; a missing source flagged *Unsourced*.
- Full interface in a headless browser against a mock server: profile, ideas, keep/reject, remix and decision log all worked with no errors; profile persisted after reload.

**11:32–11:44 · Deploy · Will**
Set up an Anthropic Console account (separate from the claude.ai subscription) with US$5 prepaid credit, a spend limit and an API key; set up GitHub and Vercel accounts.

**11:51 · Decision · Will**
Created the GitHub repository `WillNewton36/lorekeeper`. Asked for the app to be "far more sophisticated, aesthetically pleasing, and user friendly" than v1, and for this log to record everything.

**11:55 · Build · Claude**
Connected the repository to the session. Committed v1 as the first version so the history shows the progression from prototype to v2.

**11:58 · Build · Claude** (v2: streaming backend)
- Rebuilt `api/_lib.js` to stream Claude's response. The server now reads each event as it arrives and forwards three kinds to the browser: each search query, the sources it returned, and the moment the AI starts writing. *Why:* a full research run takes 30–90 seconds; in a 5–6 minute pitch, a silent spinner wastes demo time. The live trail turns the wait into evidence of how the tool works.
- Paused searches (`pause_turn`) continue automatically, now with the streamed blocks rebuilt exactly as Claude sent them.
- `api/ideas.js`: the model now receives the creator's existing content plan so it does not pitch repeats; each idea gets an effort rating (low, medium, high).
- New `api/health.js` shows whether the research engine is connected without spending credit.
- Clearer error messages written for the user (for example, "Add your niche on the Brand page first").

**12:02 · Test · Claude**
New automated server tests (`dev/test-api.mjs`) against a fake Claude API that streams like the real one and pauses mid-research. Passed: pause continued, two searches streamed live, a planted fake source flagged *Not found in search*, a missing source flagged *No source*, validation and missing-key errors handled.

**12:05 · Decision · Claude**
Design direction for v2. v1 used the most common AI-generated look (cream paper, serif headings, clay accent), which reads as generic. v2 uses a cool marble background with a verdigris accent, the blue-green patina on old bronze statues of philosophers, tying the look to the niche. Typefaces: Spectral for reading text and hooks, Hanken Grotesk for the interface. The one bold element is the dark research trail panel; everything else stays quiet.

**12:05–12:20 · Build · Claude** (v2: interface)
Rebuilt the front end as an app with a sidebar and seven pages (`index.html`, `assets/styles.css`, `assets/app.js`):
- **Studio:** four setup steps that tick off as you go; "your page at a glance" (median views, median save rate, strongest format, most-saved post) calculated in the browser from your post data, with no AI involved; pipeline counts; last research run.
- **Brand:** grouped form with autosave and a completeness meter; post data is parsed into a table with view bars and save rates, so you can see your data is being read correctly.
- **Research ideas:** focus chips built from your content pillars; 3/5/6 idea picker; **live research trail** showing each search and source as it happens; "What is working on your page" insights; ideas as expandable articles with a source summary visible before opening; Keep, Reject (with reason) and Copy on every idea; previous runs kept and selectable.
- **Remix with credit:** side-by-side "Structure you can borrow" and "Belongs to [creator]"; original idea with similarity rating and credit line; same live trail.
- **Content plan (new):** kept ideas go straight to a board with four stages (Shortlisted, Scripting, Filmed, Posted); drag and drop or arrow buttons; planned date and script notes per idea; CSV export. *Why:* this delivers the "content creation plan" from the original idea without building a separate calendar.
- **Decisions:** filter by kept or rejected, records whether each idea came from Research or Remix, CSV export.
- **How it works:** the pipeline, what each source label means, where human judgement stays essential.
- Source labels renamed into plain language: *Found in search*, *Not found in search*, *No source*.
- Responsive down to phone width, visible keyboard focus, respects reduced-motion settings, no browser pop-up dialogs.

**12:20 · Test · Claude**
Automated browser test (`dev/test-ui.py`) of the full journey: load sample creator, research with a pillar focus, watch the live trail, keep one idea, reject one with a reason, remix a reference post, move a plan card, check the decision log, reload. No errors; profile, ideas and plan all persisted after reload.
Screenshot review found and fixed three issues: plan card buttons overflowing narrow columns; the empty research trail pushing controls down on phones (now hidden until research starts); a blank gap above the heading on phones (grid rows stretching to fill the screen).

**12:25 · Build · Claude**
Updated the README; excluded the `dev/` test folder from deployment; committed v2 and pushed to GitHub.
