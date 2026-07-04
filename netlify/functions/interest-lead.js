// Interest / early-access lead capture for the School + Business CTAs.
// Accepts { name, email, organization, role, source, ts } and appends a row
// to an Airtable table (default "Leads", fields: Name, Email, Organization,
// Role, Source, Submitted At). No auth — these are prospective-customer leads.
// Best-effort + honest: returns { ok:true, saved:<bool> } so the client shows
// a success screen only when the row actually saved, and an email fallback
// otherwise (so a lead is never silently lost).
const { json, CORS } = require('./_shared');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appA3GHugWvfSg5fm';
const LEADS_TABLE = process.env.AIRTABLE_LEADS_TABLE || 'Leads';
const SOURCES = ['school', 'business'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const organization = String(body.organization || '').trim().slice(0, 160);
  const role = String(body.role || '').trim().slice(0, 120);
  const source = SOURCES.includes(String(body.source || '').toLowerCase()) ? body.source.toLowerCase() : 'unknown';
  const ts = (typeof body.ts === 'string' && body.ts) ? body.ts.slice(0, 40) : new Date().toISOString();

  if (!name || !email || !organization || !role) return json(400, { error: 'All fields are required.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Please enter a valid email.' });

  if (!AIRTABLE_API_KEY) return json(200, { ok: true, saved: false, reason: 'airtable-not-configured' });

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        'Name': name, 'Email': email, 'Organization': organization,
        'Role': role, 'Source': source, 'Submitted At': ts,
      } }),
    });
    if (!r.ok) return json(200, { ok: true, saved: false, reason: 'airtable-' + r.status });
    return json(200, { ok: true, saved: true });
  } catch (e) {
    return json(200, { ok: true, saved: false, reason: 'error' });
  }
};
