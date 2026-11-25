import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { appRoot, expoCli } from './mobile-tooling.mjs';
import { readMetroRecord, removeMetroRecord, verifyMetroOwner } from './managed-metro.mjs';

const directory=join(appRoot,'.expo','casms-processes');
if(process.argv.length>2) throw new Error('Usage: stop-mobile.bat (only managed Metro processes).');
if(!existsSync(directory)) {console.log('No managed Metro process.');process.exit(0);}
for(const name of readdirSync(directory).filter(name=>/^metro-\d+\.json$/.test(name))) {
  const path=join(directory,name), record=readMetroRecord(path);
  if(!record) continue;
  if(!Number.isSafeInteger(record.pid)||record.pid<1||!Number.isFinite(record.createdAt)||record.createdAt<=0) throw new Error('Invalid or starting process record; no process stopped.');
  if(process.platform!=='win32') throw new Error('This ownership-checked stop command is Windows-only.');
  const probe=spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${record.pid}'; if($p){ @{command=$p.CommandLine;executable=$p.ExecutablePath;created=$p.CreationDate.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`],{encoding:'utf8',windowsHide:true});
  if(probe.status!==0) throw new Error('Cannot verify process ownership. No process stopped.');
  if(!probe.stdout.trim()) {removeMetroRecord(path,record.token);continue;}
  const actual=JSON.parse(probe.stdout);
  if(!verifyMetroOwner(record,Number(name.match(/^metro-(\d+)\.json$/)[1]),expoCli(),actual)) throw new Error('Process identity changed. No process stopped.');
  const result=spawnSync('taskkill.exe',['/PID',String(record.pid),'/T','/F'],{stdio:'inherit',windowsHide:true});
  if(result.status!==0) throw new Error('Could not stop the managed process.');
  removeMetroRecord(path,record.token);
}
