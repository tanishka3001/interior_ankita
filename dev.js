const { spawn } = require('child_process');

function start(command, args, label, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ...options.env,
    },
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
}

const apiServer = start('node', ['server.js'], 'API server', {
  env: {
    PORT: '5001',
  },
});
const clientServer = start('npx', ['react-scripts', 'start'], 'React client');

function shutdown() {
  apiServer.kill();
  clientServer.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);