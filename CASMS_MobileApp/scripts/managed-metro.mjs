import { openSync, closeSync, readFileSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export function readMetroRecord(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

function withRecordLock(path, action) {
  const lock = `${path}.lock`;
  const fd = openSync(lock, 'wx');
  try { return action(); }
  finally { closeSync(fd); unlinkSync(lock); }
}

export function reserveMetroRecord(path, cli, port) {
  try {
    return withRecordLock(path, () => {
      const record = { token: randomUUID(), pid: null, createdAt: Date.now(), cli, port };
      writeFileSync(path, JSON.stringify(record, null, 2), { flag: 'wx' });
      return record;
    });
  } catch (error) {
    // Hard termination can leave a reservation/lock. Do not guess its owner.
    if (error.code === 'EEXIST') error.message += ' A managed Metro record or lock exists. Run stop-mobile.bat. After interrupted startup, verify no Metro is running before manually removing stale files from .expo/casms-processes.';
    throw error;
  }
}

export function setMetroPid(path, token, pid) {
  withRecordLock(path, () => {
    const record = readMetroRecord(path);
    if (record?.token !== token) throw new Error('Metro reservation changed; refusing to replace its owner.');
    const temporary = `${path}.${token}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify({ ...record, pid, createdAt: Date.now() }, null, 2));
      renameSync(temporary, path);
    } finally {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  });
}

export function removeMetroRecord(path, token) {
  try {
    return withRecordLock(path, () => {
      if (readMetroRecord(path)?.token !== token) return false;
      unlinkSync(path);
      return true;
    });
  } catch (error) {
    // Concurrent cleanup may already have removed the record, or hold its lock.
    // Preserve any replacement owner and let a later stop retry a stale record.
    if (error.code === 'ENOENT' || error.code === 'EEXIST') return false;
    throw error;
  }
}

const samePath = (left, right) => typeof left === 'string' && resolve(left).toLowerCase() === resolve(right).toLowerCase();

export function verifyMetroOwner(record, filePort, cli, actual, nodeExecutable = process.execPath) {
  if (!record || !Number.isSafeInteger(record.pid) || record.pid < 1 ||
      !Number.isSafeInteger(record.port) || record.port < 1024 || record.port > 65535 ||
      record.port !== filePort || record.cli !== cli ||
      !/^[a-f0-9-]{36}$/.test(record.token ?? '') ||
      !Number.isFinite(record.createdAt) || record.createdAt <= 0) return false;
  const created = Date.parse(actual.created);
  if (!Number.isFinite(created) || Math.abs(created - record.createdAt) > 10000 ||
      !samePath(actual.executable, nodeExecutable)) return false;
  const args = Array.from((actual.command ?? '').matchAll(/"([^"\r\n]*)"|([^\s"]+)/g), match => match[1] ?? match[2]);
  return args.length === 6 && samePath(args[0], nodeExecutable) && samePath(args[1], cli) &&
    args[2] === 'start' && args[3] === '--port' && args[4] === String(record.port) &&
    ['--dev-client', '--go', '--web'].includes(args[5]);
}
