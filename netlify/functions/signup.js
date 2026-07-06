const bcrypt = require('bcryptjs');
const { json, CORS, findByEmail, createRecord, signToken, isAdminEmail, isValidAccessCode, isReviewerCode } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = (body.password || '').trim();
  const age = parseInt(body.age, 10) || null;
  const accessCode = (body.accessCode || '').trim();

  if (!name || !email || !password) return json(400, { error: 'Please fill in all fields.' });
  if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });

  const existing = await findByEmail(email);
  if (existing && existing.fields && existing.fields.Status === 'Active') {
    return json(409, { error: 'An account with this email already exists.' });
  }

  const admin = isAdminEmail(email);
  // A reviewer code grants full access + the institutional/teacher view, but is
  // never admin. Admin remains strictly email-based (ADMIN_EMAILS).
  const reviewer = !admin && isReviewerCode(accessCode);
  const fullAccess = admin || reviewer || isValidAccessCode(accessCode);
  const hash = await bcrypt.hash(password, 10);

  const fields = {
    'Name': name,
    'Email': email,
    'Age': age,
    'Signed Up': new Date().toISOString().slice(0, 10),
    'Code': hash,
    // "Reviewer" is a distinct value so login can restore the institutional view
    // and so it can be revoked later by flipping this field to "No".
    'Full Access': reviewer ? 'Reviewer' : (fullAccess ? 'Yes' : 'No'),
    'Status': 'Active',
  };
  const rec = await createRecord(fields, { typecast: true });
  if (rec.error) return json(502, { error: 'Could not create account. Please try again.' });

  const token = signToken({ email, name, isAdmin: admin, fullAccess, reviewer });
  return json(200, { token, user: { email, name, age, fullAccess, isAdmin: admin, reviewer } });
};
