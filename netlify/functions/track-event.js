// Anonymous, first-party click logging for the audience router.
// Accepts { card, ts } and appends ONE row per click to an Airtable table
// (default "RouterClicks", fields: Card [text], Clicked At [text]).
// No auth: these are anonymous landing-page interactions with no PII.
// Best-effort: if Airtable isn't configured or the table doesn't exist, we
// still return 200 with logged:false so the client never sees an error.
const { json, CORS } = require('./_shared');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appA3GHugWvfSg5fm';
const EVENTS_TABLE = process.env.AIRTABLE_EVENTS_TABLE || 'RouterClicks';
const CARDS = ['individual', 'parent', 'school', 'business'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const card = String(body.card || '').toLowerCase();
  if (!CARDS.includes(card)) return json(400, { error: 'Unknown card' });

  const ts = (typeof body.ts === 'string' && body.ts) ? body.ts.slice(0, 40) : new Date().toISOString();

  if (!AIRTABLE_API_KEY) return json(200, { ok: true, logged: false, reason: 'airtable-not-configured' });

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(EVENTS_TABLE)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'Card': card, 'Clicked At': ts } }),
    });
    if (!r.ok) return json(200, { ok: true, logged: false, reason: 'airtable-' + r.status });
    return json(200, { ok: true, logged: true });
  } catch (e) {
    return json(200, { ok: true, logged: false, reason: 'error' });
  }
};
