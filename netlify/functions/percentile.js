const { json, CORS, listRecords, verifyToken } = require('./_shared');

// Returns the caller's percentile rank by Total XP among all active users,
// without exposing any other user's identity or data — aggregate only.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const claims = verifyToken(event.headers.authorization || event.headers.Authorization);
  if (!claims) return json(401, { error: 'Not authenticated.' });

  const records = await listRecords();
  const active = records.filter(r => (r.fields || {}).Status !== 'Pending Approval');
  const me = active.find(r => (r.fields.Email || '').toLowerCase() === claims.email.toLowerCase());
  const myXP = me ? (me.fields['Total XP'] || 0) : 0;
  const allXP = active.map(r => r.fields['Total XP'] || 0);
  const total = allXP.length;

  if (total <= 2 || myXP <= 0) {
    return json(200, { eligible: false, totalUsers: total });
  }

  const ahead = allXP.filter(x => x < myXP).length;
  const pctAhead = Math.round((ahead / (total - 1)) * 100);
  const topPercent = Math.max(1, 100 - pctAhead);

  // Only ever surface this when it's a genuinely motivating signal (top
  // quartile) — mirrors TryHackMe only badging the top 10%. Otherwise the
  // client shows nothing rather than a discouraging rank.
  const brackets = [1, 5, 10, 25];
  const bracket = brackets.find(b => topPercent <= b);

  return json(200, {
    eligible: !!bracket,
    topPercent: bracket || null,
    totalUsers: total,
  });
};
