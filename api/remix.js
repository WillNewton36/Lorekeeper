import { runWithSearch, extractJson, checkClaims, rateLimited, clip, sendError, openStream, readBody, MODEL } from './_lib.js';

const SYSTEM = `You are Lorekeeper's Remix tool. A creator has seen another creator's post they admire and wants to learn from it WITHOUT copying it.

Your job:
1. Break the reference post down into transferable STRUCTURE: hook pattern, format, pacing, framing device, and why it works psychologically. Structure is fair to learn from.
2. List what belongs to the original creator and must NOT be copied: their specific script lines, personal stories, signature phrases, unique examples, visual bits.
3. Build ONE original idea for the requesting creator that reuses the structure but with a different subject, example or argument drawn from their own niche and voice. Use web_search to find real material (studies, texts, historical episodes) to make it substantive.
4. Write a short attribution line the creator can use to credit the inspiration (e.g. in a caption or comment).
5. Rate the similarity risk (low / medium / high): how close is your idea to the original in substance, not just structure? Explain why. If it is medium or high, say what to change.
6. Every factual claim must cite a URL that your web_search actually returned in this session. Never invent sources. Use "source_url": null if unsourced.

You only know what the creator pasted about the reference post; do not pretend to have watched it.

Do not write any commentary. Reply with ONLY a JSON object wrapped in <result></result> tags, matching exactly:
{
  "structure": { "hook_pattern": "string", "format": "string", "pacing": "string", "framing_device": "string", "why_it_works": "string" },
  "do_not_copy": ["string"],
  "original_idea": { "title": "string", "hook": "string", "angle": "string", "outline": ["beat 1", "beat 2", "beat 3"], "how_it_differs": "string" },
  "attribution": "string",
  "similarity_risk": { "level": "low|medium|high", "reason": "string" },
  "claims": [ { "claim": "string", "source_url": "string or null", "source_title": "string or null" } ]
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Use POST.');
  if (rateLimited(req)) return sendError(res, 429, 'You have run a lot of research this hour. Try again in a little while.');

  const { profile = {}, reference = {} } = await readBody(req);
  const description = clip(reference.description, 4000);
  if (!description) return sendError(res, 400, 'Describe the post you want to learn from.');
  const user = `MY PROFILE
Niche: ${clip(profile.niche, 300) || '(not given)'}
Voice: ${clip(profile.voice, 600) || '(not given)'}
Pillars: ${clip(profile.pillars, 400) || '(not given)'}
Audience: ${clip(profile.audience, 400) || '(not given)'}
Avoid: ${clip(profile.avoid, 400) || '(nothing specified)'}

REFERENCE POST
Creator: ${clip(reference.creator, 120) || '(not given)'}
Link: ${clip(reference.link, 400) || '(not given)'}
What it does / says: ${description}
What I liked about it: ${clip(reference.liked, 800) || '(not given)'}

Break it down and give me one original idea in my voice.`;

  const send = openStream(res);
  send({ type: 'stage', label: 'Breaking down the reference post' });
  try {
    const { queries, retrieved, text, usage, stopReason } = await runWithSearch({ system: SYSTEM, user, maxSearches: 3, maxTokens: 12000, onEvent: send });
    send({ type: 'stage', label: 'Checking every source against the search results' });
    if (stopReason === 'max_tokens') throw new Error('The answer ran longer than allowed and was cut off. Shorten the post description and run it again.');
    const out = extractJson(text);
    send({
      type: 'done',
      data: {
        ...out,
        claims: checkClaims(out.claims, retrieved),
        reference: { creator: clip(reference.creator, 120), link: clip(reference.link, 400) },
        research: { queries, sources: [...retrieved.values()] },
        meta: { model: MODEL, usage, generated_at: new Date().toISOString() },
      },
    });
  } catch (err) {
    send({ type: 'error', message: err.message || 'Something went wrong. Run it again.' });
  }
  res.end();
}
