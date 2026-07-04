// Admin-only aggregate of audience-router clicks. Reads the "RouterClicks"
// Airtable table and returns per-card totals + last-clicked timestamp.
// Returns { available:false } (with zeroed totals) if Airtable isn't
// configured or the table doesn't exist yet, so the dashboard can fall back
// to the browser-local counts gracefully.
const { json, CORS, verifyToken } = require('./_shared');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appA3GHugWvfSg5fm';
const EVENTS_TABLE = process.env.AIRTABLE_EVENTS_TABLE || 'RouterClicks';
const CARDS = ['individual', 'parent', 'school', 'business'];

function emptyTotals() {
  const t = {};
  CARDS.forEach(c => { t[c] = { count: 0, last: null }; });
  return t;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const claims = verifyToken(event.headers.authorization || event.headers.Authorization);
  if (!claims || !claims.isAdmin) return json(403, { error: 'Admin access required.' });

  const totals = emptyTotals();
  if (!AIRTABLE_API_KEY) return json(200, { available: false, totals, totalEvents: 0 });

  try {
    const base = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(EVENTS_TABLE)}`;
    const headers = { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` };
    let offset;
    let totalEvents = 0;
    do {
      const url = offset ? `${base}?pageSize=100&offset=${offset}` : `${base}?pageSize=100`;
      const r = await fetch(url, { headers });
      if (!r.ok) return json(200, { available: false, totals: emptyTotals(), totalEvents: 0 });
      const d = await r.json();
      (d.records || []).forEach(rec => {
        const f = rec.fields || {};
        const card = String(f['Card'] || '').toLowerCase();
        if (!totals[card]) return;
        totals[card].count += 1;
        totalEvents += 1;
        const at = f['Clicked At'] || '';
        if (at && (!totals[card].last || at > totals[card].last)) totals[card].last = at;
      });
      offset = d.offset;
    } while (offset);

    return json(200, { available: true, totals, totalEvents });
  } catch (e) {
    return json(200, { available: false, totals: emptyTotals(), totalEvents: 0 });
  }
};
