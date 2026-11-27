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

**12:07 · Deploy · Will + Claude**
First push was refused (Claude GitHub App permission not yet active for the repository). Will confirmed the app was installed; the retry succeeded. v1 and v2 are now on GitHub at `WillNewton36/lorekeeper`.

## 23 November 2026: deployment

**14:02 · Deploy · Will**
Imported the repository into Vercel. Vercel rejected the project name "LoreKeeper" because project names must be lowercase; renamed to `lorekeeper` (affects the web address only, not the app's name).

**14:06 · Deploy · Will**
Deployed to production on Vercel with `ANTHROPIC_API_KEY` set as an environment variable (the key is stored only in Vercel, never in the code). Build took 8 seconds. The deployment preview showed the Studio page loading correctly.

**14:09 · Deploy · Will**
Live at **https://lorekeeper-ten-blond.vercel.app/** (the public prototype link for the reference list and slides).

**14:12 · Test · Claude** (first real run against the Claude API)
Checked `/api/health`: research engine connected, model `claude-sonnet-5-5`. Ran one research request on the live site with the sample creator, 3 ideas:
- Finished in 63 seconds. The live trail streamed correctly: one stage message, 4 searches, 4 sets of sources, then the writing stage.
- Real research found: Epicurus' *Letter to Menoeceus*; Bellezza, Paharia and Keinan's study of busyness as a status symbol (Columbia Business School); Seneca's *On the Shortness of Life*; Whillans et al. (2017, PNAS), "Buying time promotes happiness" (n = 6,271).
- Ideas returned: "Why being 'so busy' became a status symbol (and what Seneca would say)", "Epicurus and the 'enough' test", "Time over money: what a 6,000-person study says about buying back your hours".
- Source check: 13 of 15 claims were *Found in search*. 2 were flagged *Not found in search*.
- Token use was about 8,200 output tokens for 3 ideas, close to the 8,000 limit.

**14:15 · Change · Claude** (findings from the first real run)
- **Investigated the 2 flagged claims: false alarms.** Both cited the real Whillans PNAS paper through a Google Scholar link. The search had returned that paper (including on pnas.org and a Scholar link), but the AI wrote the Scholar link differently (dropped some authors), and the search tool's copy had HTML-encoded characters (`&amp;`). The exact-URL rule was stricter than intended.
- **Fix:** the source check now matches in two ways: the same URL (now also ignoring encoded characters), or **the same paper by its DOI**, the permanent ID every journal article has. A made-up DOI is still flagged. Re-running the check on the live result gave 15 of 15 claims found, which is correct.
- *Reflection for Part A:* the safeguard failed safe. It flagged real sources for a human to check rather than letting a fake one through. Tightening it reduced false alarms without weakening the core rule.
- **Output limit raised** from 8,000 to 16,000 tokens for ideas (8,000 for remix) so 5–6 ideas are not cut off; prompts now tell the AI to skip commentary outside the JSON. If an answer is ever cut off, the app says so plainly instead of failing silently.
- Fixed the output token count (it was being added up instead of read as a running total).
- New automated tests for DOI matching and encoded links. All tests passed.
- *Cost observed:* about US$0.15–0.20 per full research run (searches plus output), more than the earlier estimate of "a few cents". US$5 covers about 25–30 runs.

## 26 November 2026: analytics upload

**10:30 · Decision · Will**
Asked how to get a CSV of post analytics and whether there was an easier way for users to bring their analytics into the app.

**10:32 · Research · Claude**
Instagram's own app only exports insights to a spreadsheet with a paid Meta One plan. The free route is Meta Business Suite on a computer: Insights → Content → Export data (CSV, post level). Meta's export contains many columns Lorekeeper doesn't need (Post ID, Account ID, Permalink, Duration, "Data comment") and full multi-line captions.

**10:35 · Change · Claude** (analytics upload)
- **Found a bug before Will hit it:** the old reader could pick "Post ID" as the post title, and multi-line captions would break rows apart.
- **New CSV reader:** handles captions with commas, quotes and line breaks; detects comma or tab separators; skips any title rows above the header; never uses ID, link, account or duration columns as the title; prefers exact column names (so "Comments" wins over "Data comment").
- **New "Upload your analytics export" button** on the Brand page. It reads Meta's file in the browser (the file is never sent anywhere), keeps only topic, format, date, views, likes, saves, shares and comments, trims captions to 110 characters, sorts newest first and keeps the 40 most recent posts. *Why:* keeps the data the AI sees short and relevant, and means the user never edits raw CSV.
- Excel files are refused with a plain instruction to export as CSV instead.
- The post table now shows each post's format and date.
- *Privacy point for Part A:* analytics stay on the user's device until they choose to run research, and only the tidied columns are sent then.

**10:42 · Test · Claude**
New browser test (`dev/test-upload.py`) with a file shaped like Meta's export (byte-order mark, Post ID first, a two-line caption, quotes inside a caption, "Data comment" before "Comments"). First run found comments reading as blank ("Data comment" matched first); fixed by preferring exact names. Second run: all 3 posts and all 8 columns correct. Full interface test and server tests passed with no errors.

**10:48 · Test · Will** (first real export)
Downloaded his real Meta Business Suite export. On his Mac it opened in Numbers, and the app's file picker would not accept it (the picker only allowed CSV-type files, so a `.numbers` file was greyed out).

**10:50 · Change · Claude**
Removed the file-type restriction on the upload button so no file is greyed out. Picking a Numbers or Excel file now shows a plain instruction to export it as CSV (Numbers: File → Export To → CSV). *Why:* Mac users often won't realise a CSV has been opened and re-saved in Numbers; the app should explain the fix rather than silently refuse.

**10:57 · Test · Will** (first research run on his own data)
Uploaded his real CSV successfully. Ran a 5-idea batch on his @newtonslores profile. It failed with "The answer ran longer than allowed and was cut off."

**11:12 · Change · Claude**
- *Cause:* real data (up to 40 posts) gives the AI much more to analyse than the 7-post sample, so 5 ideas plus insights exceeded the 16,000-token output limit. The whole batch was lost, which is the wrong failure: the finished ideas were still usable.
- **Limit raised** to 24,000 output tokens for ideas and 12,000 for remix. (Kept below the level that could exceed Vercel's 300-second function limit.)
- **Concision rule added to the prompt:** one or two sentences per field, exactly 3 outline beats, at most 3 claims per idea, at most 3 performance insights. *Why:* shorter output is faster, cheaper and easier to read on stage.
- **Graceful cut-off:** if an answer is still cut off, the server now recovers every idea that was written in full and drops only the unfinished one. The page says "Showing 3 of 5 ideas" with an explanation, instead of an error and nothing.
- New automated test for recovering finished ideas from a cut-off answer. All server and interface tests passed.
- *Reflection for Part A:* testing on real data exposed a failure the sample data never triggered; the fix changes the failure from "lose everything" to "keep what is complete and say so".

**11:40 · Test · Will** (successful run on his own data)
After the cut-off fix, ran a research batch on his real @newtonslores profile and analytics. It completed and the results were good.

**11:46 · Decision · Will**
Asked for a new section for creating and refining scripts, worked through the design with Claude before building.

**11:48 · Decision · Will + Claude** (script section design)
Claude proposed the flow (open a kept idea, draft, refine, instant checks, versions) and flagged that this is the sharpest "creativity and identity" question in the project: idea generation is AI as researcher, script writing is AI writing the creator's words. Will's choices:
- **AI's role: both modes.** *Draft for me* (AI writes, creator refines) and *Coach me* (creator writes every word; AI gives feedback but does not rewrite). Chosen per script.
- **Length:** 45–60 seconds by default, adjustable (30–45, 45–60, 60–90).
- **Style: two options.** (1) The creator's own voice, pillars and best-performing posts. (2) Inspired by a chosen creator. Claude's design for option 2, consistent with Remix: the user describes the creator's style (the app does not scrape or watch their videos); the AI borrows structure and craft only (hook pattern, pacing, rhythm), never their lines, catchphrases or stories; a credit line is added.
- **Scope: essentials only** (draft, refine, checks, versions). Teleprompter and b-roll notes deferred to future work.

**11:50–12:30 · Build · Claude** (Scripts)
- `api/script.js` with three modes: draft, refine, coach. **No web search**: scripts may only use the idea's already source-checked claims; claims flagged *Not found in search* are excluded. If a script needs an unsourced fact, the AI must write `[CHECK: ...]` instead of inventing it. Findings must not be overstated. Coach mode is instructed never to rewrite, only to quote a line, name the weakness and suggest a direction.
- New **Scripts** page, opened from a **Write script** button on every Content plan card (opening one moves the card to *Scripting*). Settings: mode, style, length. Script editor with autosave, Copy, four one-click refinements (*Sharpen the hook*, *Cut 20%*, *More spoken*, *Stronger ending*) plus a free-text instruction.
- **Instant checks (no AI):** estimated speaking time at about 150 words a minute against the target; hook length (aim 15 words or fewer); any number or year in the script that does not appear in the idea's checked claims; `[CHECK]` markers still to resolve. *Why:* extends the source-check safeguard from ideas into the words actually spoken on camera.
- **Version history labelled by author** ("Lorekeeper: First draft", "Lorekeeper: Cut 20%", "You: Your edits"), with restore. *Why:* makes visible how much of a script is the creator's own writing, which is evidence for the identity and authorship reflection.

**12:30 · Test · Claude**
New browser test (`dev/test-script.py`): keep an idea, open its script, draft, refine, switch to coach mode, get feedback, restore a version, reload. All passed with no errors; the card moved to Scripting and the script persisted. The checks correctly flagged "72%" and "2021" in a test draft because they came from a claim the search never found. Screenshot review found and fixed two bugs: the creator-style fields and the coaching button showed when they should be hidden (a CSS rule overrode the hidden attribute), and the date field on plan cards was squeezed to nothing. Existing interface and server tests still passed.

## 27 November 2026: Part A submitted; bring back rejected ideas

**15:50 · Deploy · Will**
Part A (written strategy) completed and submitted. Slides extended to Monday 30 November, 7am.

**21:08 · Decision · Will**
Asked for rejected ideas to be recoverable.

**21:10 · Change · Claude** (bring back rejected ideas)
- **Bring back** button on every rejected idea (on the idea itself and in Decisions). The idea becomes undecided again and can be kept or rejected afresh.
- **The decision log is now append-only.** Bringing an idea back adds a "Brought back" entry; the original rejection and its reason stay in the record. *Why:* the log is the evidence of the creator's judgement, so changing your mind should be visible, not erase the earlier decision.
- From Decisions, a brought-back idea can be kept directly, which adds it to the Content plan.
- Each new decision stores a copy of the idea, so it can be recovered even after its research run drops out of the saved history (the last 8 runs).
- Decision counts now reflect each idea's current state (kept, rejected, brought back); new "Brought back" filter; brought-back entries included in the CSV export.

**21:15 · Test · Claude**
New browser test (`dev/test-restore.py`): reject with a reason, bring back from the idea card, reject again, bring back from Decisions, keep. The idea reached the Content plan, all five decisions stayed in the log in order, and the idea card showed it as kept. Full interface and script tests passed with no errors. Fixed "1 ideas" to "1 idea".
