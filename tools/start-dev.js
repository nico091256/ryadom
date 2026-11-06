// tools/start-dev.js
// Starts @localshop/backend on port 4000 and @localshop/store (Next.js) on port 3000 (0.0.0.0)
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sharedDist = path.join(rootDir, 'packages', 'shared', 'dist', 'index.js');
const backendDir = path.join(rootDir, 'apps', 'backend');
const backendDist = path.join(backendDir, 'dist', 'src', 'main.js');
const storeDir = path.join(rootDir, 'apps', 'store');

function runSync(cmd, args, cwd = rootDir) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.warn(`Command exited with status ${res.status}: ${cmd} ${args.join(' ')}`);
  }
}

// 1. Ensure shared package is built and backend is built if dist is missing
if (!fs.existsSync(sharedDist)) {
  runSync('npm', ['run', 'build'], path.join(rootDir, 'packages', 'shared'));
}
if (!fs.existsSync(backendDist)) {
  runSync('npm', ['run', 'prisma:generate'], backendDir);
  runSync('npm', ['run', 'build'], backendDir);
}

// 2. Spawn NestJS backend on port 4000
const backend = spawn('node', ['dist/src/main.js'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '4000', NODE_ENV: 'development', CORS_ORIGINS: '' },
});

// 3. Spawn Next.js store panel on port 3000 (0.0.0.0)
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: storeDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000', HOSTNAME: '0.0.0.0', NODE_ENV: 'development', NEXT_PUBLIC_API_URL: '' },
});

function shutdown() {
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

frontend.on('exit', (code) => {
  backend.kill('SIGTERM');
  process.exit(code ?? 0);
});
