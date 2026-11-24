import { spawnSync } from 'node:child_process';
import { readQaConfig } from '../tests/integration/qa-environment.mjs';

function run() {
  try { readQaConfig(); } catch (error) {
    console.error(error.message);
    return 2;
  }
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/integration/*.test.mjs'], {
    stdio: 'inherit',
  });
  if (result.error) console.error('BLOCKED_BY_ENVIRONMENT: Không thể khởi động Node test runner.');
  return result.status ?? 1;
}
process.exitCode = run();
