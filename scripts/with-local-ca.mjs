import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [mode, executable, ...args] = process.argv.slice(2);
const validModes = new Set(['docker', 'host']);

if (!validModes.has(mode) || !executable) {
  console.error('Usage: node scripts/with-local-ca.mjs <host|docker> <command> [...args]');
  process.exit(1);
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const hostCertificatePath = path.join(repoRoot, 'certs', 'local-ca.pem');
const env = { ...process.env };

if (!env.NODE_EXTRA_CA_CERTS && existsSync(hostCertificatePath)) {
  env.NODE_EXTRA_CA_CERTS =
    mode === 'docker' ? '/app/certs/local-ca.pem' : hostCertificatePath;
  console.log(`[local-ca] Using NODE_EXTRA_CA_CERTS=${env.NODE_EXTRA_CA_CERTS}`);
} else if (!env.NODE_EXTRA_CA_CERTS) {
  console.log('[local-ca] No certs/local-ca.pem found; continuing without NODE_EXTRA_CA_CERTS');
}

const child = spawn(executable, args, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
