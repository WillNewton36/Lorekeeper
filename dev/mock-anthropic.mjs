// A fake Claude API that streams server-sent events like the real one, for local testing without credit.
// The first call pauses mid-research (pause_turn) to exercise the continuation logic.

const enc = new TextEncoder();
const sources1 = [
  { type: 'web_search_result', url: 'https://plato.stanford.edu/entries/seneca/', title: 'Seneca (Stanford Encyclopedia of Philosophy)', page_age: '2023', encrypted_content: 'x' },
  { type: 'web_search_result', url: 'https://www.gutenberg.org/ebooks/64576?utm_source=t', title: 'On the Shortness of Life, Project Gutenberg', encrypted_content: 'x' },
];
const sources2 = [
  { type: 'web_search_result', url: 'https://pubmed.ncbi.nlm.nih.gov/25000000/', title: 'Social comparison on social media and depressive symptoms (meta-analysis)', page_age: '2022', encrypted_content: 'x' },
  { type: 'web_search_result', url: 'https://iep.utm.edu/epictetu/', title: 'Epictetus (Internet Encyclopedia of Philosophy)', encrypted_content: 'x' },
];

const claimsA = [
  { claim: 'Seneca argued life is long enough if it is used well, not wasted on busyness', source_url: 'https://plato.stanford.edu/entries/seneca', source_title: 'SEP: Seneca' },
  { claim: 'A 2021 survey found 72% of adults feel chronically time-poor', source_url: 'https://madeup-journal.org/time-poverty', source_title: 'Journal of Time Studies' },
  { claim: 'De Brevitate Vitae was written around 49 AD', source_url: null },
];
const claimsB = [
  { claim: 'Meta-analysis links upward social comparison on social media with depressive symptoms', source_url: 'https://pubmed.ncbi.nlm.nih.gov/25000000', source_title: 'PubMed meta-analysis' },
];
const ideasJson = {
  performance_insights: [
    { insight: 'One thinker, one idea, talking to camera is your strongest format', evidence: 'Marcus Aurelius (48.2k views) and Seneca (31.5k) beat the listicle (6.1k) by 5–8x' },
    { insight: 'Saves track depth, not views', evidence: 'Seneca on busyness had the best save rate (3.8%) despite fewer views than Marcus Aurelius' },
    { insight: 'Personal vlogs underperform on this account', evidence: 'My week without social media: 4.3k views, 0.6% saves' },
  ],
  ideas: [
    { title: 'Seneca on borrowed time', pillar: 'Philosophy', format: 'Talking-head reel', effort: 'low', hook: 'Seneca thought you weren’t short of time. You were giving it away.', angle: 'Busyness is a choice that feels like an obligation.', outline: ['Open on Seneca’s line about people guarding money but not time', 'The modern version: calendar as a donation box', 'One practice: audit who you gave your week to'], why_it_fits: 'Builds on your highest-save post without repeating it: same thinker, new question.', claims: claimsA, accuracy_risk: 'Seneca wrote to a wealthy aristocrat; avoid implying he was talking to modern shift workers.', craft_tip: 'Cut your first scripted sentence and open on the second; it is almost always the real hook.' },
    { title: 'Why comparison feels like losing', pillar: 'Personal growth', format: 'Story-led reel', effort: 'medium', hook: 'Epictetus was owned by another man, and he still had more freedom than your feed gives you.', angle: 'Comparison is a judgement you make, not something done to you.', outline: ['Epictetus: what is up to us and what is not', 'What the research says about comparison online', 'The dichotomy of control applied to scrolling'], why_it_fits: 'Pairs a thinker (your best format) with a study (your audience saves evidence-backed posts).', claims: claimsB, accuracy_risk: 'The research shows correlation, not that social media causes depression. Say “linked to”.', craft_tip: 'Put the study on screen as text so viewers can screenshot it; it drives saves.' },
  ],
};
const remixJson = {
  structure: { hook_pattern: 'Contrarian claim about a famous thinker', format: 'Talking-head, single take', pacing: 'Jump cuts every 2–3 seconds, no b-roll', framing_device: 'Then vs now: an ancient idea held up against a modern habit', why_it_works: 'The contradiction creates an open loop the viewer stays to close.' },
  do_not_copy: ['Their story about quitting a corporate job', 'Their sign-off phrase', 'Their example of a gym bro reading Nietzsche'],
  original_idea: { title: 'Epictetus would not have a morning routine', hook: 'The freest man in Rome had no routine, no journal and no app. He was a slave.', angle: 'Freedom as control over judgement, not optimisation of habits.', outline: ['Who Epictetus was', 'What he said is up to us', 'Why habit stacking can be another form of control by others'], how_it_differs: 'Different thinker, argument and examples; only the contrarian-hook structure is shared.' },
  attribution: 'Format inspired by @othercreator. Go watch their take on Nietzsche.',
  similarity_risk: { level: 'low', reason: 'Shares the structure only. Subject, argument and examples are all different.' },
  claims: [{ claim: 'Epictetus was born into slavery', source_url: 'https://iep.utm.edu/epictetu', source_title: 'IEP: Epictetus' }],
};

function sse(events, delay) {
  return new ReadableStream({
    async start(ctrl) {
      for (const e of events) {
        if (delay) await new Promise((r) => setTimeout(r, e.__wait ?? delay));
        delete e.__wait;
        ctrl.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      }
      ctrl.close();
    },
  });
}
function searchEvents(start, id, query, results) {
  const q = JSON.stringify({ query });
  return [
    { type: 'content_block_start', index: start, content_block: { type: 'server_tool_use', id, name: 'web_search', input: {} } },
    { type: 'content_block_delta', index: start, delta: { type: 'input_json_delta', partial_json: q.slice(0, 10) } },
    { type: 'content_block_delta', index: start, delta: { type: 'input_json_delta', partial_json: q.slice(10) } },
    { type: 'content_block_stop', index: start },
    { type: 'content_block_start', index: start + 1, content_block: { type: 'web_search_tool_result', tool_use_id: id, content: results }, __wait: 900 },
    { type: 'content_block_stop', index: start + 1 },
  ];
}
function textEvents(start, text) {
  const out = [{ type: 'content_block_start', index: start, content_block: { type: 'text', text: '' } }];
  for (let i = 0; i < text.length; i += 400) out.push({ type: 'content_block_delta', index: start, delta: { type: 'text_delta', text: text.slice(i, i + 400) }, __wait: 40 });
  out.push({ type: 'content_block_stop', index: start });
  return out;
}

export function makeMockFetch({ delay = 0, log = [] } = {}) {
  let call = 0;
  return async (url, opts) => {
    const body = JSON.parse(opts.body);
    log.push(body);
    if (!body.stream) {
      if (delay) await new Promise((r) => setTimeout(r, 800));
      let out;
      if (body.system.includes('script coach')) out = { overall: 'Strong idea and a clear argument, but the middle drifts and the ending is generic.', hook: 'Good tension, but 18 words is too long to land before the scroll.', strengths: ['The Seneca line is well placed', 'Plain, spoken language'], unsupported_claims: [{ line: 'Most people waste half their week', problem: 'No source in your checked claims supports this figure.' }], lines: [{ line: 'And that is why time matters.', issue: 'Restates the point without adding anything.', direction: 'End on a question or an action the viewer can take tonight.' }] };
      else if (body.system.includes('revise')) out = { script: 'Seneca thought you weren’t short of time.\nYou were giving it away.\n\nWe guard our money and hand out our hours to anyone who asks.\nHe called that the strangest habit of all.\n\nSo tonight, look at your week.\nWho did you give it to?', change_summary: 'Shortened the hook to 8 words and cut the middle by about a fifth.' };
      else out = { script: 'Seneca thought you weren’t short of time. You were giving it away.\n\nTwo thousand years ago he noticed people guard their money but hand out their hours to anyone who asks.\nLife is long enough, he argued, if you actually use it.\n\nA 2021 survey found 72% of adults feel chronically time-poor.\n[CHECK: source for the 2021 survey]\n\nSo here is the question.\nThis week, who did you give your time to?\nAnd did you choose them?', notes: ['Opened on the hook from the idea', 'Kept Seneca’s argument at the strength the source supports', 'Marked the survey figure to check because it was not found in search'], style_credit: body.system.includes('inspired by') ? 'Structure inspired by @othercreator' : '' };
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '<result>' + JSON.stringify(out) + '</result>' }], stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 400 } }) };
    }
    const isRemix = body.system.includes('Remix');
    call++;
    const msgStart = { type: 'message_start', message: { usage: { input_tokens: 1200 } } };
    let events;
    if (isRemix) {
      events = [msgStart, ...searchEvents(0, 's9', 'Epictetus slavery freedom Discourses', sources2), ...textEvents(2, '<result>' + JSON.stringify(remixJson) + '</result>'),
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 900 } }, { type: 'message_stop' }];
    } else if (body.messages.length === 1) {
      events = [msgStart, ...searchEvents(0, 's1', 'Seneca On the Shortness of Life time busyness', sources1),
        { type: 'message_delta', delta: { stop_reason: 'pause_turn' }, usage: { output_tokens: 50 } }, { type: 'message_stop' }];
    } else {
      events = [msgStart, ...searchEvents(0, 's2', 'social comparison social media meta-analysis wellbeing', sources2),
        ...textEvents(2, 'Here are your ideas. <result>' + JSON.stringify(ideasJson) + '</result>'),
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2400 } }, { type: 'message_stop' }];
    }
    return { ok: true, status: 200, body: sse(events, delay) };
  };
}
