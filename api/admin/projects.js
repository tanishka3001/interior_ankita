const { ObjectId } = require('mongodb');
const connectToDatabase = require('../_lib/mongodb');
const getAdminToken = require('../_lib/adminToken');

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

async function requireAdminToken(req, res) {
  const adminToken = getAdminToken();

  if (!adminToken) {
    sendJson(res, 500, { error: 'ADMIN_TOKEN is not configured on the backend.' });
    return false;
  }

  const providedToken = req.headers['x-admin-token'];
  if (providedToken !== adminToken) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return false;
  }

  return true;
}

module.exports = async (req, res) => {
  if (!(await requireAdminToken(req, res))) {
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('portfolio_projects');

    if (req.method === 'GET') {
      const projects = await collection.find({}).sort({ createdAt: -1 }).toArray();
      sendJson(res, 200, { ok: true, projects });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const name = String(body.name || '').trim();
      const scope = String(body.scope || '').trim();
      const note = String(body.note || '').trim();
      const imageUrl = String(body.imageUrl || '').trim();

      if (!imageUrl) {
        sendJson(res, 400, { error: 'Image URL is required.' });
        return;
      }

      const result = await collection.insertOne({
        name,
        scope,
        note,
        imageUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      sendJson(res, 201, {
        ok: true,
        project: {
          _id: result.insertedId,
          name,
          scope,
          note,
          imageUrl,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const projectId = String(body.projectId || '').trim();

      if (!projectId) {
        sendJson(res, 400, { error: 'projectId is required.' });
        return;
      }

      await collection.deleteOne({ _id: new ObjectId(projectId) });
      sendJson(res, 200, { ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin projects API error:', error);
    sendJson(res, 500, { error: 'Unable to manage projects right now.' });
  }
};