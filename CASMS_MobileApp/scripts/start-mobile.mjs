import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot, mobilePort, checkedToolchain, expoCli, assertFreePort } from './mobile-tooling.mjs';
import { resolveApiUrl } from '../src/lib/api/api-client.ts';
import { reserveMetroRecord, setMetroPid, removeMetroRecord } from './managed-metro.mjs';

async function start() {
  const [mode, ...rest] = process.argv.slice(2);
  if (rest.length || (mode && !['--android', '--web', '--go'].includes(mode))) {
    console.error('Usage: start-mobile.bat [--android | --web | --go]');
    return 2;
  }
  let url;
  try { url = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL); } catch (error) {
    console.error(error.message);
    return 2;
  }
  const cli=expoCli(), port=mobilePort(process.env.CASMS_METRO_PORT);
  const env=mode==='--android' ? checkedToolchain().env : process.env;
  await assertFreePort(port);
  const state=join(appRoot,'.expo','casms-processes'); mkdirSync(state,{recursive:true});
  const record=join(state,`metro-${port}.json`);
  const reservation=reserveMetroRecord(record,cli,port);
  console.log(mode==='--go' ? 'Expo Go: NFC is unavailable.' : mode==='--web' ? 'Web preview: native POS/NFC are unavailable.' : 'Development client: install the matching approved native build first.');
  console.log(`Metro port${port}. API configured explicitly. No Backend or database is started.`);
  const child = spawn(process.execPath, [cli, 'start', '--port',String(port), mode==='--go' ? '--go' : mode==='--web' ? '--web' : '--dev-client'], {
    stdio: 'inherit', cwd:appRoot, windowsHide:true,
    env: { ...env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: url },
  });
  child.once('spawn',()=>{
    try { setMetroPid(record,reservation.token,child.pid); }
    catch (error) { console.error(error.message); child.kill(); }
  });
  const code=await new Promise(resolve=>{child.once('error',()=>resolve(1)); child.once('exit',value=>resolve(value??1));});
  removeMetroRecord(record,reservation.token);
  return code;
}
start().then(code=>{process.exitCode=code;}).catch(error=>{console.error(error.message);process.exitCode=2;});
