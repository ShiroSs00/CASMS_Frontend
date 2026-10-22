import { readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? collect(file) : entry.name.endsWith('.test.mjs') ? [file] : []
  })
}
const files = ['src', 'tests'].flatMap(directory => collect(path.join(root, directory))).sort()
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', env: { ...process.env, CASMS_LIVE_QA: '' } })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
