// Isolated visual QA API. No database, real credentials, or upstream forwarding.
import { createServer } from 'node:http'
import process from 'node:process'
import { URL } from 'node:url'
const jobs = new Map()
const permissions = ['USER_READ', 'SHIP_MODEL_CREATE', 'SHIP_CREATE', 'SHIP_UPDATE', 'SHIP_READ']
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let body = ''
  for await (const chunk of req) body += chunk.toString()
  const reply = (data, status = 200, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: status < 400, data, message })) }
  const path = url.pathname.replace(/^\/api/, '')
  if (path === '/auth/login' || path === '/auth/refresh') return reply({ accessToken: 'local-ui-fixture-only', userId: 'ui-fixture', username: 'ui-fixture', roles: ['ADMIN'], tokenType: 'Bearer', expiresIn: 3600 })
  if (path === '/auth/me') return reply({ userId: 'ui-fixture', effectivePermissions: permissions })
  if (path === '/identity/users') return reply([])
  if (path === '/ship-model-assets' && req.method === 'POST') {
    if (!req.headers['content-type']?.startsWith('multipart/form-data; boundary=') || !body.includes('name="bundle"')) return reply(null, 400, 'Expected multipart bundle')
    return reply({ modelKey: url.searchParams.get('modelKey'), assetVersion: url.searchParams.get('assetVersion'), fileCount: 18 }, 201)
  }
  if (path.endsWith('/register')) return reply({ shipId: 'fixture-ship', shipModelId: `fixture-model-${path.split('/')[3]}`, shipCreated: true }, 201)
  if (path.endsWith('/imports') && req.method === 'POST') {
    const modelId = path.split('/')[4]
    const status = modelId.endsWith('-success') ? 'SUCCEEDED' : modelId.endsWith('-failed') ? 'FAILED' : 'PARTIAL'
    const job = { jobId: 'fixture-job', shipId: 'fixture-ship', modelId, status, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), totalObjects: 320, decksImported: status === 'FAILED' ? 0 : 13, cabinsImported: status === 'FAILED' ? 0 : status === 'SUCCEEDED' ? 305 : 304, objectsSucceeded: status === 'FAILED' ? 0 : status === 'SUCCEEDED' ? 320 : 319, objectsFailed: status === 'FAILED' ? 320 : status === 'SUCCEEDED' ? 0 : 1, objectsSkipped: 0, errorMessage: 'One or more model objects could not be imported' }
    jobs.set(modelId, job)
    return reply(job, 201)
  }
  if (path.endsWith('/imports')) { const job = jobs.get(path.split('/')[4]); return reply(job ? [job] : []) }
  if (path.endsWith('/issues')) return reply([{ issueId: 'fixture-issue', objectIdentifier: 'conquest-d01-r4-c0001', objectType: 'CABIN', errorCode: 'MANIFEST_GLB_MISMATCH', message: 'Cabin metadata differs between the GLB and manifest' }])
  return reply(null, 404, 'No fixture for this request')
}).listen(5188, '127.0.0.1', () => process.stdout.write('Isolated ship import fixture: 5188\n'))
