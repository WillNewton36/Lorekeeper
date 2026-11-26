import { runWithSearch, extractJson, salvageArray, checkClaims, rateLimited, clip, sendError, openStream, readBody, MODEL } from './_lib.js';

const SYSTEM = `You are Lorekeeper, a research-grounded content strategist for educational short-form creators (philosophy, psychology, history, science and similar niches).

Your job: turn the creator's brand profile and past performance into original, on-brand content ideas that are backed by real research.

Rules you must follow:
1. RESEARCH FIRST. Use the web_search tool to find specific, substantive material in the creator's niche: studies, primary texts, historical episodes, thinkers' actual arguments, expert commentary. Prefer scholarly, primary and reputable sources over listicles and content farms.
2. NO FABRICATION. Every factual claim (a study finding, a quote, a date, a statistic, what a thinker argued) must cite a URL that your web_search actually returned in this session. Never invent studies, quotes, numbers or URLs. If you cannot source a claim, either drop it or include it with "source_url": null so the creator knows to check it.
3. PERFORMANCE INSIGHTS. Analyse the creator's past posts. Name concrete patterns (topic, hook style, format) and point to the specific posts that show them. If no performance data was given, say so plainly rather than guessing.
4. FIT THE BRAND. Ideas must match the creator's voice, pillars and audience, and respect their "avoid" list. Each idea must say why it fits, referring to the profile or past posts.
5. HONESTY OVER VIRALITY. Do not suggest hooks that misrepresent research or overstate findings. For each idea, name the main accuracy risk (e.g. oversimplifying a study, a misattributed quote, a small sample).
6. ORIGINALITY. Do not reproduce other creators' scripts or signature bits.
7. AVOID REPEATS. Do not pitch ideas the creator has clearly already posted (see their past posts and the 'already planned' list); build on what worked instead.
9. BE CONCISE. Each field is one or two sentences. Give exactly 3 outline beats, at most 3 claims per idea and at most 3 performance insights. Quality over volume.
8. SKILL BUILDING. Give one practical craft tip per idea that would make the creator better at making this kind of video.

When research is done, do not write any commentary. Reply with ONLY a JSON object wrapped in <result></result> tags, matching exactly:
{
  "performance_insights": [ { "insight": "string", "evidence": "string (which posts show this)" } ],
  "ideas": [
    {
      "title": "string",
      "pillar": "string (one of the creator's pillars)",
      "format": "string (e.g. talking-head reel, carousel, story-led reel)",
      "hook": "string (the first line, as it would be spoken or shown)",
      "angle": "string (the core point or twist)",
      "outline": ["beat 1", "beat 2", "beat 3"],
      "why_it_fits": "string",
      "claims": [ { "claim": "string", "source_url": "string or null", "source_title": "string or null" } ],
      "accuracy_risk": "string",
      "effort": "low | medium | high (how hard it is to film and edit)",
      "craft_tip": "string"
    }
  ]
}`;

function formatProfile(p) {
  return [
    `Creator handle: ${clip(p.handle, 80) || '(not given)'}`,
    `Platform(s): ${clip(p.platform, 80) || '(not given)'}`,
    `Niche: ${clip(p.niche, 300)}`,
    `Target audience: ${clip(p.audience, 400) || '(not given)'}`,
    `Voice and style: ${clip(p.voice, 600) || '(not given)'}`,
    `Content pillars: ${clip(p.pillars, 400) || '(not given)'}`,
    `Goals: ${clip(p.goals, 400) || '(not given)'}`,
    `Avoid: ${clip(p.avoid, 400) || '(nothing specified)'}`,
    `Creators they admire (for context only, not to copy): ${clip(p.inspirations, 400) || '(none given)'}`,
    '',
    'Past posts and performance (as provided by the creator):',
    clip(p.posts, 9000) || '(no performance data provided)',
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Use POST.');
  if (rateLimited(req)) return sendError(res, 429, 'You have run a lot of research this hour. Try again in a little while.');

  const { profile = {}, focus = '', count = 5, planned = [] } = await readBody(req);
  if (!clip(profile.niche, 300)) return sendError(res, 400, 'Add your niche on the Brand page first.');
  const n = Math.min(Math.max(parseInt(count, 10) || 5, 1), 6);
  const plannedList = (Array.isArray(planned) ? planned : []).slice(0, 30).map((t) => `- ${clip(t, 140)}`).join('\n');

  const user = `${formatProfile(profile)}

Already planned or shortlisted (do not repeat):
${plannedList || '(nothing yet)'}

Request: research my niche and give me ${n} content ideas.${clip(focus, 400) ? ` Focus this batch on: ${clip(focus, 400)}.` : ''}`;

  const send = openStream(res);
  send({ type: 'stage', label: 'Reading your brand profile and past posts' });
  try {
    const { queries, retrieved, text, usage, stopReason } = await runWithSearch({ system: SYSTEM, user, maxSearches: 6, maxTokens: 24000, onEvent: send });
    send({ type: 'stage', label: 'Checking every source against the search results' });
    let out; let truncated = false;
    if (stopReason === 'max_tokens') {
      // Cut off part-way: keep every idea that was written in full rather than losing the whole batch.
      truncated = true;
      out = { performance_insights: salvageArray(text, 'performance_insights'), ideas: salvageArray(text, 'ideas') };
      if (!out.ideas.length) throw new Error('The answer ran longer than allowed before any idea was finished. Ask for 3 ideas and run it again.');
    } else out = extractJson(text);
    const ideas = (out.ideas || []).map((idea) => ({ ...idea, claims: checkClaims(idea.claims, retrieved) }));
    send({
      type: 'done',
      data: {
        performance_insights: out.performance_insights || [],
        ideas,
        research: { queries, sources: [...retrieved.values()] },
        meta: { model: MODEL, usage, generated_at: new Date().toISOString(), focus: clip(focus, 400), truncated, requested: n },
      },
    });
  } catch (err) {
    send({ type: 'error', message: err.message || 'Something went wrong. Run it again.' });
  }
  res.end();
}
