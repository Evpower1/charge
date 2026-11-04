// Regression check: a production build must not open, initialize, or seed SQLite.
// Run through npm so the same install/build entry points are exercised.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

assert.ok(process.env.npm_execpath, 'Run npm run test:build-no-db');
const directory = mkdtempSync(join(tmpdir(), 'evpower-build-no-db-'));
const blocker = join(directory, 'not-a-directory');
const marker = 'A build must not access this database location.';
writeFileSync(blocker, marker, { mode: 0o600 });
try {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_PATH: join(blocker, 'database.sqlite'),
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      CHAPA_SECRET_KEY: '',
      APP_DEMO_MODE: 'false'
    }
  });
  assert.equal(result.status, 0, 'Production build attempted database access or otherwise failed');
  assert.equal(readFileSync(blocker, 'utf8'), marker);
  console.log('PASS: production build completed with an unusable database path and no database initialization.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
