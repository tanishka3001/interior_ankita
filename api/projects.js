const connectToDatabase = require('./_lib/mongodb');

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

  try {
    const { db } = await connectToDatabase();
    const projects = await db
      .collection('portfolio_projects')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    sendJson(res, 200, {
      ok: true,
      projects,
    });
  } catch (error) {
    console.error('Projects API error:', error);
    sendJson(res, 500, { error: 'Unable to load projects right now.' });
  }
};