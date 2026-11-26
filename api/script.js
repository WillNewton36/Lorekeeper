// Script studio: draft a script, refine it, or coach the creator on their own draft.
// No web search here: scripts may only use claims already researched and source-checked for the idea.
import { runPlain, extractJson, rateLimited, clip, sendError, readBody, MODEL } from './_lib.js';

const LENGTHS = {
  '30-45': { label: '30 to 45 seconds', words: '75 to 110 words' },
  '45-60': { label: '45 to 60 seconds', words: '110 to 150 words' },
  '60-90': { label: '60 to 90 seconds', words: '150 to 220 words' },
};

const BASE = `You are Lorekeeper's script studio for an educational short-form creator. Scripts are spoken to camera, so write for the ear: short sentences, plain words, one idea per line, no headings, no stage directions unless asked, no hashtags or emojis.

Non-negotiable rules:
1. FACTS ONLY FROM THE IDEA'S SOURCES. Every factual claim (finding, statistic, date, quote, what a thinker argued) must come from the "Checked claims" list provided. Do not add new facts, numbers or quotes. If the script needs a fact that is not in the list, write [CHECK: what needs verifying] instead of inventing it.
2. DO NOT OVERSTATE. Keep findings at the strength the source supports (e.g. "linked to", not "causes").
3. HONOUR THE BRAND. Match the creator's voice and respect their "never suggest" list.`;

const STYLE_VOICE = `STYLE: the creator's own voice. Base rhythm, openings and tone on their voice description and on the posts that performed best for them.`;
const styleCreator = (s) => `STYLE: inspired by ${clip(s.creator, 120) || 'another creator'}. The creator described their style as: "${clip(s.description, 1500)}".
Borrow only STRUCTURE AND CRAFT: hook pattern, pacing, sentence rhythm, how they build to a point, how they end. Never reuse their actual lines, catchphrases, sign-offs, personal stories or examples. The topic, argument and examples must come from the idea and the creator's own brand.`;

function context(profile, idea, length, style) {
  const best = String(profile.posts || '').split('\n').slice(1, 6).map((l) => `- ${clip(l, 160)}`).join('\n');
  const claims = (idea.claims || []).filter((c) => c.status !== 'source-not-retrieved')
    .map((c) => `- ${clip(c.claim, 300)}${c.source_url ? ` [${clip(c.source_url, 300)}]` : ' [no source: must be marked CHECK if used]'}`).join('\n');
  const L = LENGTHS[length] || LENGTHS['45-60'];
  return `CREATOR
Handle: ${clip(profile.handle, 80) || '(not given)'}
Niche: ${clip(profile.niche, 300)}
Voice: ${clip(profile.voice, 600) || '(not given)'}
Audience: ${clip(profile.audience, 400) || '(not given)'}
Never suggest: ${clip(profile.avoid, 400) || '(nothing specified)'}
Recent posts (topic, format, views, ...):
${best || '(none provided)'}

IDEA
Title: ${clip(idea.title, 200)}
Hook: ${clip(idea.hook, 300)}
Angle: ${clip(idea.angle, 400) || '(not given)'}
Outline: ${(idea.outline || []).map((x, i) => `${i + 1}. ${clip(x, 200)}`).join(' ')}
Checked claims (the only facts allowed):
${claims || '(none: the script must not state any specific facts)'}

TARGET LENGTH: ${L.label}, about ${L.words}.
${style?.type === 'creator' ? styleCreator(style) : STYLE_VOICE}`;
}

const OUT_SCRIPT = `Reply with ONLY a JSON object in <result></result> tags:
{ "script": "the full script, lines separated by \\n", "notes": ["up to 3 short notes on choices you made"], "style_credit": "one-line credit to the inspiring creator, or empty string if writing in the creator's own voice" }`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Use POST.');
  if (rateLimited(req, Number(process.env.RATE_LIMIT_PER_HOUR || 20) * 3)) return sendError(res, 429, 'You have made a lot of requests this hour. Try again in a little while.');
  const { mode, profile = {}, idea = {}, length = '45-60', style = { type: 'voice' }, script = '', instruction = '' } = await readBody(req);
  if (!clip(idea.title, 200)) return sendError(res, 400, 'Open an idea from your content plan first.');
  const ctx = context(profile, idea, length, style);
  let system; let user;

  if (mode === 'draft') {
    system = `${BASE}\n\nTask: write a first draft of the script. Open with a hook of 15 words or fewer that earns the next line. Follow the outline. End on a line that lands the point; no generic "follow for more".\n\n${OUT_SCRIPT}`;
    user = `${ctx}\n\nWrite the first draft.`;
  } else if (mode === 'refine') {
    if (!clip(script, 6000)) return sendError(res, 400, 'There is no script to refine yet.');
    if (!clip(instruction, 400)) return sendError(res, 400, 'Choose a refinement or type an instruction.');
    system = `${BASE}\n\nTask: revise the creator's current script according to their instruction. Change only what the instruction calls for and keep the rest of their wording. If the creator has edited lines themselves, keep those edits.\n\nReply with ONLY a JSON object in <result></result> tags:\n{ "script": "the revised script", "change_summary": "one or two sentences on what you changed" }`;
    user = `${ctx}\n\nCURRENT SCRIPT\n${clip(script, 6000)}\n\nINSTRUCTION: ${clip(instruction, 400)}`;
  } else if (mode === 'coach') {
    if (!clip(script, 6000)) return sendError(res, 400, 'Write some of your script first, then ask for feedback.');
    system = `${BASE}\n\nTask: you are a script coach. The creator writes every word themselves. Do NOT rewrite the script. Give specific, honest feedback they can act on: quote the line, say what is weak, and suggest a direction (not a replacement line). Flag any factual claim that is not supported by the checked claims list, and any claim stated more strongly than the source supports.\n\nReply with ONLY a JSON object in <result></result> tags:\n{ "overall": "two or three sentences", "hook": "feedback on the opening line", "lines": [ { "line": "quoted line", "issue": "what is weak", "direction": "how to fix it, without writing it for them" } ], "unsupported_claims": [ { "line": "quoted line", "problem": "why it is not supported or overstated" } ], "strengths": ["up to 3 things that work"] }\nGive at most 6 line notes.`;
    user = `${ctx}\n\nMY SCRIPT\n${clip(script, 6000)}`;
  } else return sendError(res, 400, 'Unknown script mode.');

  try {
    const { text, usage, stopReason } = await runPlain({ system, user, maxTokens: 4000 });
    if (stopReason === 'max_tokens') throw new Error('The answer was cut off. Try again, or shorten the script.');
    const out = extractJson(text);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...out, meta: { model: MODEL, usage, mode, generated_at: new Date().toISOString() } }));
  } catch (err) {
    sendError(res, 500, err.message || 'Something went wrong. Try again.');
  }
}
