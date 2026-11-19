// Lets the app show whether the research engine is connected. Spends no API credit.
import { MODEL } from './_lib.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ connected: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL }));
}
