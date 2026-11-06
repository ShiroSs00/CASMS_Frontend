const maxManifestBytes = 8 * 1024 ** 2
const invalid = () => new Error('Không đọc được manifest.json từ ZIP. Kiểm tra gói hoặc xuất lại ở định dạng ZIP chuẩn.')
const decoder = new TextDecoder('utf-8', { fatal: true })

export type LocalManifest = { modelKey: string; deckCount: number; cabinCount: number; areaCount: number; nodeKeys: Set<string> }

// Read only the central directory and manifest. Large GLB entries stay in the selected File.
export async function readBundleManifest(file: File): Promise<LocalManifest> {
  if (!/\.zip$/i.test(file.name) || !file.size || file.size > 2 * 1024 ** 3) {
    throw new Error('Chọn gói ZIP có dữ liệu, dung lượng tối đa 2 GB.')
  }
  const read = async (start: number, length: number) => {
    if (start < 0 || length < 0 || start + length > file.size) throw invalid()
    return new DataView(await file.slice(start, start + length).arrayBuffer())
  }
  const tailLength = Math.min(file.size, 65557)
  const tail = await read(file.size - tailLength, tailLength)
  let end = tailLength - 22
  while (end >= 0 && (tail.getUint32(end, true) !== 0x06054b50 || end + 22 + tail.getUint16(end + 20, true) !== tailLength)) end--
  if (end < 0 || tail.getUint16(end + 4, true) || tail.getUint16(end + 6, true)) throw invalid()
  const size = tail.getUint32(end + 12, true)
  const offset = tail.getUint32(end + 16, true)
  if (!size || size > maxManifestBytes || offset + size > file.size - tailLength + end) throw invalid()
  const directory = await read(offset, size)
  let manifest: { start: number; compressed: number; expanded: number; method: number } | undefined
  let pathKey: string | undefined
  for (let i = 0; i < size;) {
    if (i + 46 > size || directory.getUint32(i, true) !== 0x02014b50) throw invalid()
    const nameLength = directory.getUint16(i + 28, true)
    const next = i + 46 + nameLength + directory.getUint16(i + 30, true) + directory.getUint16(i + 32, true)
    if (next > size) throw invalid()
    const name = decoder.decode(new Uint8Array(directory.buffer, i + 46, nameLength))
    const prefixed = /^model-assets\/([a-z0-9-]+)\/[\w.-]+\/manifest\.json$/.exec(name)
    if (name === 'manifest.json' || prefixed) {
      if (manifest || directory.getUint16(i + 8, true) & 1) throw invalid()
      manifest = { method: directory.getUint16(i + 10, true), compressed: directory.getUint32(i + 20, true),
        expanded: directory.getUint32(i + 24, true), start: directory.getUint32(i + 42, true) }
      pathKey = prefixed?.[1]
    }
    i = next
  }
  if (!manifest || !manifest.expanded || manifest.expanded > maxManifestBytes || manifest.compressed > maxManifestBytes) throw invalid()
  const local = await read(manifest.start, 30)
  if (local.getUint32(0, true) !== 0x04034b50 || local.getUint16(8, true) !== manifest.method) throw invalid()
  const start = manifest.start + 30 + local.getUint16(26, true) + local.getUint16(28, true)
  if (start + manifest.compressed > offset) throw invalid()
  const entry = file.slice(start, start + manifest.compressed)
  let contents: ArrayBuffer | Uint8Array
  if (manifest.method === 0 && manifest.compressed === manifest.expanded) contents = await entry.arrayBuffer()
  else if (manifest.method === 8) {
    const reader = entry.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
    const bytes = new Uint8Array(manifest.expanded)
    let position = 0
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        if (position + chunk.value.byteLength > bytes.length) throw invalid()
        bytes.set(chunk.value, position)
        position += chunk.value.byteLength
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    if (position !== bytes.length) throw invalid()
    contents = bytes
  } else throw invalid()

  const data = JSON.parse(decoder.decode(contents))
  if (!data || typeof data.modelId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(data.modelId)
    || (pathKey && pathKey !== data.modelId) || !Array.isArray(data.decks) || !Array.isArray(data.cabins)
    || (data.serviceDecks !== undefined && !Array.isArray(data.serviceDecks))
    || (data.areas !== undefined && !Array.isArray(data.areas))) throw invalid()
  const decks = [...data.decks, ...(data.serviceDecks ?? [])]
  const areas = data.areas ?? []
  const nodeKeys = new Set<string>()
  for (const item of [...decks, ...data.cabins, ...areas]) {
    if (!item || typeof item.id !== 'string' || !item.id || nodeKeys.has(item.id)) throw invalid()
    nodeKeys.add(item.id)
  }
  return { modelKey: data.modelId, deckCount: decks.length, cabinCount: data.cabins.length, areaCount: areas.length, nodeKeys }
}
