import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveApiUrl } from '../src/lib/api/api-client.ts';

function start() {
  const [mode, ...rest] = process.argv.slice(2);
  if (rest.length || (mode && !['--android', '--web'].includes(mode))) {
    console.error('Usage: start-mobile.bat [--android | --web]');
    return 2;
  }
  let url;
  try { url = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL); } catch (error) {
    console.error(error.message);
    return 2;
  }
  const require = createRequire(import.meta.url);
  let expoCli;
  try { expoCli = require.resolve('expo/bin/cli'); } catch {
    console.error('Expo is missing. Run npm ci in CASMS_MobileApp before starting.');
    return 2;
  }
  const result = spawnSync(process.execPath, [expoCli, 'start', ...(mode ? [mode] : [])], {
    stdio: 'inherit',
    env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: url },
  });
  if (result.error) console.error('Could not start Expo.');
  return result.status ?? 1;
}
process.exitCode = start();
