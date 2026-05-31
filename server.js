const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const routes = {
  'GET /api/projects': require('./api/projects'),
  'POST /api/contact': require('./api/contact'),
  'GET /api/admin/verify': require('./api/admin/verify'),
  'GET /api/admin/messages': require('./api/admin/messages'),
  'GET /api/admin/projects': require('./api/admin/projects'),
  'POST /api/admin/projects': require('./api/admin/projects'),
  'DELETE /api/admin/projects': require('./api/admin/projects'),
};

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');

      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const routeKey = `${req.method} ${req.url.split('?')[0]}`;
    const handler = routes[routeKey];

    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      req.body = await collectBody(req);
    }

    await handler(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'Server error' }));
  }
});

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Local API server running on http://localhost:${port}`);
});