const bcrypt = require('bcryptjs');
const { json, CORS, csaHash, findByEmail, patchRecord, signToken, isAdminEmail } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const email = (body.email || '').trim().toLowerCase();
  const password = (body.password || '').trim();
  if (!email || !password) return json(400, { error: 'Please enter your email and password.' });

  const rec = await findByEmail(email);
  if (!rec || !rec.fields || rec.fields.Status !== 'Active') {
    return json(401, { error: 'Incorrect email or password.' });
  }

  const stored = rec.fields['Code'] || '';
  let ok = false;

  if (stored.startsWith('$2')) {
    // Modern bcrypt hash
    ok = await bcrypt.compare(password, stored);
  } else if (stored) {
    // Legacy csaHash — verify once, then upgrade to bcrypt transparently
    ok = (csaHash(password) === stored);
    if (ok) {
      try { await patchRecord(rec.id, { 'Code': await bcrypt.hash(password, 10) }); } catch (e) { /* non-fatal */ }
    }
  }

  if (!ok) return json(401, { error: 'Incorrect email or password.' });

  const f = rec.fields;
  const admin = isAdminEmail(email);
  const fullAccess = admin || f['Full Access'] === 'Yes';
  const token = signToken({ email, name: f['Name'] || email, isAdmin: admin, fullAccess });
  return json(200, {
    token,
    user: {
      email,
      name: f['Name'] || email,
      age: f['Age'] || null,
      fullAccess,
      isAdmin: admin,
      labsComplete: f['Labs Complete'] || 0,
      totalXP: f['Total XP'] || 0,
    },
  });
};
