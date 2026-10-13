import assert from 'node:assert/strict'

const debugPort = globalThis.process.env.CHROME_DEBUG_PORT ?? '9223'
const pages = await globalThis.fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json())
const page = pages.find((candidate) => candidate.type === 'page')

assert.ok(page, 'No Chrome page was available for the Cruise browser smoke test')

const socket = new globalThis.WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 1

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(expression, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for: ${expression}`)
}

await command('Page.enable')
await command('Runtime.enable')

await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/admin/cruises?status=DRAFT&type=ONE_DAY&ship=UNASSIGNED',
})
await waitFor(`document.body.innerText.includes('CR-051220-03')`)

const filteredList = await evaluate(`({
  hasExpectedCruise: document.body.innerText.includes('CR-051220-03'),
  excludesOtherCruise: !document.body.innerText.includes('CR-261120-01'),
  selectedStatus: document.querySelector('#cruise-status')?.value,
  selectedType: document.querySelector('#cruise-type')?.value,
  selectedShip: document.querySelector('#cruise-ship')?.value,
})`)
assert.deepEqual(filteredList, {
  hasExpectedCruise: true,
  excludesOtherCruise: true,
  selectedStatus: 'DRAFT',
  selectedType: 'ONE_DAY',
  selectedShip: 'UNASSIGNED',
})

await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/admin/cruises/10000000-0000-4000-8000-000000000001',
})
await waitFor(`document.body.innerText.includes('CR-261120-01')`)

const clickedChange = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Đổi tàu')
  button?.click()
  return Boolean(button)
})()`)
assert.equal(clickedChange, true)
await waitFor(`document.querySelector('dialog[open]') !== null`)
await waitFor(`document.querySelector('dialog[open]')?.innerText.includes('CR-261121-04')`)

const dialog = await evaluate(`(() => {
  const root = document.querySelector('dialog[open]')
  const text = root?.innerText ?? ''
  return {
    title: root?.querySelector('h2')?.textContent,
    hasOverlap: text.includes('CR-261121-04'),
    hasMaintenance: text.includes('MAINTENANCE'),
    hasCapacityReason: text.includes('70') && text.includes('82'),
    confirmDisabled: [...(root?.querySelectorAll('button') ?? [])].find((button) => button.textContent.includes('Xác nhận'))?.disabled,
  }
})()`)
assert.equal(dialog.title, 'Đổi tàu cho CR-261120-01')
assert.equal(dialog.hasOverlap, true)
assert.equal(dialog.hasMaintenance, true)
assert.equal(dialog.hasCapacityReason, true)
assert.equal(dialog.confirmDisabled, true)

await command('Page.navigate', { url: 'http://127.0.0.1:5173/admin/cruises/new' })
await waitFor(`document.body.innerText.includes('Tạo cruise')`)
await evaluate(`(() => {
  const input = document.querySelector('#return-time')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, '2026-11-21T18:00')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  document.querySelector('button[type="submit"]').click()
})()`)
await waitFor(`document.body.innerText.includes('Chuyến một ngày phải kết thúc trong cùng ngày khởi hành.')`)
const invalidCreate = await evaluate(`({
  remainsOnForm: location.pathname === '/admin/cruises/new',
  scheduleInvalid: document.querySelector('#return-time')?.getAttribute('aria-invalid') === 'true',
  focusedFirstInvalid: document.activeElement?.getAttribute('aria-invalid') === 'true',
})`)
assert.deepEqual(invalidCreate, {
  remainsOnForm: true,
  scheduleInvalid: true,
  focusedFirstInvalid: true,
})

await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/admin/cruises/10000000-0000-4000-8000-000000000001/edit',
})
await waitFor(`document.body.innerText.includes('Chỉnh sửa cruise') && document.querySelector('#cruise-code')?.value === 'CR-261120-01'`)
assert.equal(await evaluate(`document.querySelector('#cruise-code')?.disabled`), true)
assert.equal(await evaluate(`document.querySelector('#cruise-form-status')?.value`), 'PUBLISHED')

await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/admin/cruises/10000000-0000-4000-8000-000000000003',
})
await waitFor(`document.body.innerText.includes('CR-051220-03')`)
assert.equal(await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Phân công tàu')
  button?.click()
  return Boolean(button)
})()`), true)
await waitFor(`document.querySelector('dialog[open]')?.innerText.includes('CASMS Horizon')`)
assert.equal(await evaluate(`(() => {
  const candidate = [...document.querySelectorAll('dialog[open] [role="radio"]')].find((button) => button.textContent.includes('CASMS Horizon'))
  candidate?.click()
  return Boolean(candidate)
})()`), true)
await waitFor(`(() => {
  const button = [...document.querySelectorAll('dialog[open] button')].find((candidate) => candidate.textContent.includes('Xác nhận phân công'))
  return button && !button.disabled
})()`)
await evaluate(`[...document.querySelectorAll('dialog[open] button')].find((button) => button.textContent.includes('Xác nhận phân công')).click()`)
await waitFor(`!document.querySelector('dialog[open]') && document.body.innerText.includes('CASMS Horizon')`)

assert.equal(await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent.trim() === 'Gỡ tàu')
  button?.click()
  return Boolean(button) && !button.disabled
})()`), true)
await waitFor(`document.querySelector('dialog[open]')?.innerText.includes('Xác nhận gỡ tàu')`)
await evaluate(`[...document.querySelectorAll('dialog[open] button')].find((button) => button.textContent.includes('Xác nhận gỡ tàu')).click()`)
await waitFor(`!document.querySelector('dialog[open]') && document.body.innerText.includes('Cruise chưa có tàu')`)

socket.close()
globalThis.console.log('Cruise browser smoke passed: filters, conflicts, validation, edit lock, assign and unassign')
