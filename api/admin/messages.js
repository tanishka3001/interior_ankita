const connectToDatabase = require('../_lib/mongodb');
const getAdminToken = require('../_lib/adminToken');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const adminToken = getAdminToken();

  if (!adminToken) {
    sendJson(res, 500, { error: 'ADMIN_TOKEN is not configured on the backend.' });
    return;
  }

  const providedToken = req.headers['x-admin-token'];
  if (providedToken !== adminToken) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const messages = await db
      .collection('contact_messages')
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    sendJson(res, 200, {
      ok: true,
      messages,
    });
  } catch (error) {
    console.error('Admin messages API error:', error);
    sendJson(res, 500, { error: 'Unable to load messages right now.' });
  }
};
