// Shared helpers for CyberShield serverless functions.
// Secrets come from Netlify environment variables — never from the client.
const jwt = require('jsonwebtoken');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appA3GHugWvfSg5fm';
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Users';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set. Configure it in your Netlify site environment variables (Site configuration → Environment variables).');
}
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'houstonv2345@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const ACCESS_CODES = (process.env.ACCESS_CODES || 'CYBERSHIELD-VIP,FOUNDERSCIRCLE,ETHAN-EDU-2026')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
// Reviewer codes grant full Pro access PLUS the institutional/teacher view, but
// NEVER admin. Kept in a separate env var so a reviewer can be revoked on its
// own. No default is committed — set REVIEWER_CODES in the Netlify environment.
const REVIEWER_CODES = (process.env.REVIEWER_CODES || '')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

// Legacy hash used by the old client-only version — kept so existing accounts
// can still log in once and be transparently upgraded to bcrypt.
function csaHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return h.toString(36);
}

const AT_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
const atHeaders = { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' };

async function findByEmail(email) {
  const safe = String(email).toLowerCase().replace(/"/g, '');
  const url = `${AT_URL}?filterByFormula=${encodeURIComponent(`LOWER({Email})="${safe}"`)}`;
  const r = await fetch(url, { headers: atHeaders });
  const d = await r.json();
  return (d.records && d.records[0]) || null;
}

async function createRecord(fields, opts = {}) {
  // typecast lets Airtable accept/auto-create a select option (e.g. a new
  // "Reviewer" value on the Full Access column) so writes work whether that
  // column is plain text or a single-select.
  const payload = { fields };
  if (opts.typecast) payload.typecast = true;
  const r = await fetch(AT_URL, { method: 'POST', headers: atHeaders, body: JSON.stringify(payload) });
  return r.json();
}

async function patchRecord(id, fields) {
  const r = await fetch(`${AT_URL}/${id}`, { method: 'PATCH', headers: atHeaders, body: JSON.stringify({ fields }) });
  return r.json();
}

async function listRecords() {
  const out = [];
  let offset;
  do {
    const url = offset ? `${AT_URL}?pageSize=100&offset=${offset}` : `${AT_URL}?pageSize=100`;
    const r = await fetch(url, { headers: atHeaders });
    const d = await r.json();
    (d.records || []).forEach(x => out.push(x));
    offset = d.offset;
  } while (offset);
  return out;
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
function verifyToken(auth) {
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, '');
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email).toLowerCase());
const isValidAccessCode = (code) => !!code && ACCESS_CODES.includes(String(code).trim().toUpperCase());
const isReviewerCode = (code) => !!code && REVIEWER_CODES.includes(String(code).trim().toUpperCase());

module.exports = {
  json, CORS, csaHash, findByEmail, createRecord, patchRecord, listRecords,
  signToken, verifyToken, isAdminEmail, isValidAccessCode, isReviewerCode,
};
