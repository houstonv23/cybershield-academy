// Magic-link login for reviewer/guest access.
// A shareable URL carries a high-entropy token (validated here against the
// REVIEWER_MAGIC_TOKENS env var). A valid token mints a full-access reviewer
// session — all labs at Pro + the institutional/teacher view — that is NEVER an
// admin. Revoke a link by removing/rotating its token in the Netlify env.
// No secret lives in client code: the browser only relays the token from the URL.
const { json, CORS, signToken, isReviewerMagicToken, REVIEWER_GUEST_EMAIL } = require('./_shared');

// Keep magic sessions short so a revoked link's already-minted tokens expire soon.
const MAGIC_SESSION_TTL = '7d';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const token = (body.token || '').trim();
  if (!isReviewerMagicToken(token)) {
    return json(401, { error: 'This access link is invalid or has been revoked.' });
  }

  // isAdmin is hard-set to false here — a magic link can never grant admin,
  // regardless of the identity it runs as.
  const email = REVIEWER_GUEST_EMAIL;
  const name = 'Reviewer (guest)';
  const sessionToken = signToken(
    { email, name, isAdmin: false, fullAccess: true, reviewer: true, guest: true },
    MAGIC_SESSION_TTL
  );
  return json(200, {
    token: sessionToken,
    user: { email, name, age: 30, fullAccess: true, isAdmin: false, reviewer: true, guest: true },
  });
};
