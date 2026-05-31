const connectToDatabase = require('./_lib/mongodb');

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
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const projectType = String(body.projectType || '').trim();
    const message = String(body.message || '').trim();

    if (!name || !email || !message) {
      sendJson(res, 400, { error: 'Name, email, and message are required.' });
      return;
    }

    const { db } = await connectToDatabase();

    await db.collection('contact_messages').insertOne({
      name,
      email,
      projectType,
      message,
      createdAt: new Date(),
      source: 'portfolio',
    });

    sendJson(res, 201, {
      ok: true,
      message: 'Your enquiry was received successfully.',
    });
  } catch (error) {
    console.error('Contact API error:', error);
    sendJson(res, 500, { error: error.message || 'Unable to save enquiry right now.' });
  }
};
