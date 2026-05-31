const fs = require('fs');
const path = require('path');

let cachedToken = null;

function parseEnvToken(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^ADMIN_TOKEN\s*=\s*(.+)$/m);

  if (!match) {
    return '';
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function getAdminToken() {
  if (process.env.ADMIN_TOKEN) {
    return process.env.ADMIN_TOKEN;
  }

  if (cachedToken !== null) {
    return cachedToken;
  }

  const envPath = path.join(process.cwd(), '.env');
  cachedToken = parseEnvToken(envPath);
  return cachedToken;
}

module.exports = getAdminToken;