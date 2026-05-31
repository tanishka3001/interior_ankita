const connectToDatabase = require('../_lib/mongodb');
const getAdminToken = require('../_lib/adminToken');
const { ObjectId } = require('mongodb');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) {
    return req.body;
  }

  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  return {};
}

module.exports = async (req, res) => {
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

    if (req.method === 'GET') {
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
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const messageId = String(body.messageId || '').trim();

      if (!messageId) {
        sendJson(res, 400, { error: 'messageId is required.' });
        return;
      }

      await db.collection('contact_messages').deleteOne({ _id: new ObjectId(messageId) });
      sendJson(res, 200, { ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, DELETE');
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin messages API error:', error);
    sendJson(res, 500, { error: 'Unable to load messages right now.' });
  }
};
