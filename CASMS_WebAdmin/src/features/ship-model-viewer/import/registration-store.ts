import { emptySession, restoreSession, validRegistration, type ImportSession, type Registration } from './model'

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
type RecordState = { attemptId: string; phase: 'pending' | 'registered'; registration?: Registration; previewFingerprint?: string }

export function importScope(userId: string, configuredApi: string, origin: string) {
  const api = new URL(configuredApi || '/api', origin)
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.search || api.hash) throw new Error('Địa chỉ hệ thống chưa hợp lệ.')
  return JSON.stringify([api.href.replace(/\/$/, ''), userId])
}

export function createRegistrationStore(scope: string, userId: string, local: BrowserStorage, tab: BrowserStorage) {
  const key = `ocevie:ship-import:v2:${scope}`
  const registerKey = (modelKey: string) => `${key}:register:${JSON.stringify(modelKey)}`
  const attemptKey = (draft: ImportSession) => `${registerKey(draft.modelKey)}:attempt:${draft.attemptId}`
  function hasLegacyPending(modelKey: string) {
    const prefix = `ocevie:ship-import:${userId}:register:`
    for (let index = 0; index < local.length; index++) {
      const oldKey = local.key(index)
      if (!oldKey?.startsWith(prefix) || local.getItem(oldKey) !== 'pending') continue
      try { if (JSON.parse(oldKey.slice(prefix.length))[0] === modelKey) return true } catch { /* Not a registration key. */ }
    }
    return false
  }
  function read(draft: ImportSession) {
    if (draft.scope && draft.scope !== scope) return { draft, pending: true }
    const raw = (draft.attemptId ? local.getItem(attemptKey(draft)) : null) ?? local.getItem(registerKey(draft.modelKey))
    if (raw === null) return { draft, pending: hasLegacyPending(draft.modelKey) }
    try {
      const record = JSON.parse(raw) as RecordState
      if (!record || typeof record.attemptId !== 'string') return { draft, pending: true }
      if (record.phase === 'pending') return { draft, pending: true }
      if (record.phase !== 'registered' || !validRegistration(record.registration) || !/^[0-9a-f]{64}$/.test(record.previewFingerprint ?? '')) return { draft, pending: true }
      // A successful older attempt is not proof for a newly selected ZIP, even with the same name/key.
      return record.attemptId === draft.attemptId
        ? { draft: { ...draft, registration: record.registration, previewFingerprint: record.previewFingerprint }, pending: false }
        : { draft, pending: hasLegacyPending(draft.modelKey) }
    } catch { return { draft, pending: true } }
  }
  function save(draft: ImportSession) {
    if (!draft.uploaded) tab.removeItem(key)
    else tab.setItem(key, JSON.stringify({ ...draft, scope, job: null }))
  }
  function pending(draft: ImportSession) {
    if (!draft.attemptId || draft.scope !== scope) throw new Error('Phiên tạo tàu không khớp hệ thống.')
    if (read(draft).pending) throw new Error('Lần tạo tàu trước chưa rõ kết quả. Kiểm tra hồ sơ tàu trước khi tiếp tục.')
    save(draft)
    const record = JSON.stringify({ attemptId: draft.attemptId, phase: 'pending', previewFingerprint: draft.previewFingerprint })
    local.setItem(registerKey(draft.modelKey), record)
    local.setItem(attemptKey(draft), record)
  }
  function registered(draft: ImportSession, registration: Registration) {
    if (!validRegistration(registration) || !draft.attemptId || draft.scope !== scope || !draft.previewFingerprint) throw new Error('Chưa xác nhận được hồ sơ tàu.')
    const next = { ...draft, registration }
    // Persist known IDs first: read-back failures must never permit another create request.
    const record = JSON.stringify({ attemptId: draft.attemptId, phase: 'registered', registration, previewFingerprint: draft.previewFingerprint })
    local.setItem(attemptKey(draft), record)
    local.setItem(registerKey(draft.modelKey), record)
    save(next)
    return next
  }
  function rejected(draft: ImportSession) {
    for (const recordKey of [registerKey(draft.modelKey), attemptKey(draft)]) {
      const raw = local.getItem(recordKey)
      if (raw && JSON.parse(raw).attemptId === draft.attemptId) local.removeItem(recordKey)
    }
  }
  return { key, scope, registerKey, read, save, pending, registered, rejected,
    restore() {
      const draft = restoreSession(tab.getItem(key), scope) ?? emptySession
      return draft.uploaded ? read(draft) : { draft, pending: false }
    },
  }
}

export async function prepareImport(
  draft: ImportSession, file: File | null, store: ReturnType<typeof createRegistrationStore>,
  upload: (session: ImportSession, file: File) => Promise<void>,
) {
  if (store.read(draft).pending) throw new Error('Lần tạo tàu trước chưa rõ kết quả. Kiểm tra hồ sơ tàu trước khi tải gói khác có cùng mã.')
  const next: ImportSession = { ...emptySession, modelKey: draft.modelKey, fileName: draft.fileName, scope: store.scope, attemptId: crypto.randomUUID() }
  // A selected ZIP always goes through upload. A cached registration cannot short-circuit this.
  if (file) await upload(next, file)
  const prepared = { ...next, uploaded: true }
  store.save(prepared)
  return prepared
}
