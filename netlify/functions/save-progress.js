const { json, CORS, findByEmail, patchRecord, verifyToken } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const claims = verifyToken(event.headers.authorization || event.headers.Authorization);
  if (!claims) return json(401, { error: 'Not authenticated.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }

  const labsComplete = parseInt(body.labsComplete, 10) || 0;
  const totalXP = parseInt(body.totalXP, 10) || 0;

  const rec = await findByEmail(claims.email);
  if (!rec) return json(404, { error: 'Account not found.' });

  await patchRecord(rec.id, { 'Labs Complete': labsComplete, 'Total XP': totalXP });
  return json(200, { ok: true });
};
