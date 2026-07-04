const { json, CORS, listRecords, verifyToken } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const claims = verifyToken(event.headers.authorization || event.headers.Authorization);
  if (!claims || !claims.isAdmin) return json(403, { error: 'Admin access required.' });

  const records = await listRecords();
  // Return only non-sensitive fields — never the password hash stored in "Code".
  const users = records.map(r => {
    const f = r.fields || {};
    return {
      name: f['Name'] || '',
      email: f['Email'] || '',
      age: f['Age'] ?? '',
      signedUp: f['Signed Up'] || '',
      status: f['Status'] || '',
      fullAccess: f['Full Access'] || 'No',
      labsComplete: f['Labs Complete'] || 0,
      totalXP: f['Total XP'] || 0,
    };
  });
  return json(200, { users });
};
