import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_PREVIEW_URL || 'http://127.0.0.1:5177'
assert.equal(new URL(base).hostname, '127.0.0.1')
const cruiseId = '11111111-2222-3333-4444-555555555555'
const cabinId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const evidence = process.env.CASMS_EVIDENCE_DIR
const neutralLookup = 'Không tìm thấy đặt chỗ khớp thông tin đã nhập. Kiểm tra lại mã và email hoặc số điện thoại đại diện.'
async function sandbox() {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], badResponses = [], writes = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', req => { if (req.method() === 'POST') writes.push(req.url()) })
  page.on('response', res => { if (new URL(res.url()).pathname.startsWith('/api/') && res.headers()['x-ocv-development-fixture'] !== 'true') badResponses.push(res.url()) })
  async function open(route, mode = 'ready') {
    await page.goto(base + route + (route.includes('?') ? '&' : '?') + '__fixture=' + mode)
    await page.getByRole('note', { name: 'Development fixtures' }).waitFor()
  }
  async function finish() { try { assert.deepEqual(errors, []); assert.deepEqual(badResponses, []) } finally { await browser.close() } }
  return { page, context, open, finish, writes }
}
async function capture(page, name, details = {}) {
  if (evidence) await mkdir(evidence, { recursive: true })
  const measurements = []
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    const measured = await page.evaluate(() => ({ width: globalThis.innerWidth, overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth }))
    assert.equal(measured.overflow, false, name + ' overflow at ' + width)
    measurements.push(measured)
    if (evidence) await page.screenshot({ path: path.join(evidence, name + '-' + width + '.png'), fullPage: true })
  }
  if (evidence) await writeFile(path.join(evidence, name + '.json'), JSON.stringify({ ...details, measurements }, null, 2))
}
async function tabTo(page, id) {
  for (let i = 0; i < 45; i++) {
    if (await page.evaluate(() => globalThis.document.activeElement.id) === id) return
    await page.keyboard.press('Tab')
  }
  assert.fail('Keyboard could not reach ' + id)
}
async function tabToText(page, text) {
  for (let i = 0; i < 45; i++) {
    if (await page.evaluate(() => globalThis.document.activeElement.textContent) === text) return
    await page.keyboard.press('Tab')
  }
  assert.fail('Keyboard could not reach ' + text)
}

test('V12 P1: public lookup failures do not disclose reference existence or raw server details', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    let status = 404
    await s.context.route('**/api/booking/lookup?*', route => route.fulfill({ status, headers: { 'X-Ocv-Development-Fixture': 'true' }, json: { success: false, code: status === 404 ? 'BOOKING_NOT_FOUND' : 'LOOKUP_MISMATCH', message: status === 404 ? 'DEV reference does not exist: INTERNAL_LOOKUP_DETAIL' : 'DEV reference exists, contact mismatch' } }))
    await s.open('/booking/lookup')
    await p.getByLabel('Mã đặt chỗ', { exact: true }).fill('DEV-NOT-A-LIVE-REFERENCE')
    await p.getByLabel('Email đại diện', { exact: true }).fill('qa@example.test')
    const messages = []
    for (status of [404, 403]) {
      await p.getByRole('button', { name: 'Tra cứu', exact: true }).click()
      await p.getByRole('alert').waitFor()
      messages.push(await p.getByRole('alert').innerText())
      if (status === 404) await capture(p, 'lookup-error', { text: messages[0], focus: await p.evaluate(() => globalThis.document.activeElement.id) })
    }
    assert.equal(messages[0], messages[1], 'No-match and mismatch must have the same public message')
    assert.ok(messages[0].includes(neutralLookup))
    assert.equal(await p.getByLabel('Mã đặt chỗ', { exact: true }).inputValue(), 'DEV-NOT-A-LIVE-REFERENCE')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.id), 'lookup-error-summary')
    assert.equal(await p.getByRole('region', { name: 'Không tra cứu được', exact: true }).count(), 1)
    await p.keyboard.press('Shift+Tab')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Tra cứu', 'Keyboard can return to the preserved lookup form')
  } finally { await s.finish() }
})

test('V12 P1: public read and empty cabin states offer resource-specific safe retries', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'error')
    await p.getByRole('alert').first().waitFor()
    const text = await p.locator('main').innerText()
    await capture(p, 'read-error', { text })
    const hasReadRecovery = await p.getByRole('button', { name: 'Tải lại danh sách hành trình', exact: true }).count()
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'cabins-empty')
    await p.getByText('Chưa có phòng trống cho chuyến này', { exact: true }).waitFor()
    await capture(p, 'cabins-empty')
    assert.equal(hasReadRecovery, 1)
    assert.equal(text.includes('DEV fixture: API unavailable'), false, 'Public errors must not render raw server details')
    let reads = 0
    p.on('request', req => { if (new URL(req.url()).pathname === '/api/booking/available-cabins') reads++ })
    await p.getByRole('button', { name: 'Tải lại phòng trống', exact: true }).click()
    await p.getByText('Chưa có phòng trống cho chuyến này', { exact: true }).waitFor()
    assert.ok(reads > 0)
    assert.equal(s.writes.length, 0)
  } finally { await s.finish() }
})

test('V12 P1: uncertain submission never claims rejection and returns focus to safe recovery', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/cabin-experience?cruiseId=' + cruiseId, 'create-unknown')
    await p.getByLabel('Phòng cho hành khách 1 *', { exact: true }).selectOption(cabinId)
    await p.getByRole('button', { name: 'Tiếp tục nhập hành khách', exact: true }).click()
    await p.getByLabel('Họ tên *', { exact: true }).fill('Khách QA development')
    await p.getByLabel('Email', { exact: true }).fill('qa@example.test')
    await p.getByRole('button', { name: 'Kiểm tra đặt chỗ', exact: true }).click()
    const trigger = await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).innerText()
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Đóng hộp thoại' }).waitFor()
    await p.keyboard.press('Escape')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), trigger, 'Escape restores the review trigger')
    await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).click()
    await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).click()
    await p.getByText('Kiểm tra kết quả trước khi gửi lại', { exact: true }).waitFor()
    assert.equal(await p.getByRole('dialog').getByRole('button', { name: 'Gửi đặt chỗ', exact: true }).isDisabled(), true)
    await p.keyboard.press('Escape')
    const text = await p.locator('main').innerText(), focus = await p.evaluate(() => globalThis.document.activeElement.getAttribute('aria-label'))
    await capture(p, 'uncertain', { text, focus })
    assert.equal(text.includes('Chưa gửi được đặt chỗ'), false, 'Unknown outcome must not be described as not sent')
    assert.equal(focus, 'Cần kiểm tra kết quả gửi')
    assert.equal(s.writes.length, 1)
    assert.equal(await p.getByRole('button', { name: 'Kiểm tra và gửi đặt chỗ', exact: true }).isDisabled(), true)
    await p.keyboard.press('Tab')
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Tra cứu khi đã có mã')
    await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Tra cứu đặt chỗ', exact: true }).waitFor()
    await p.goBack()
    await p.getByRole('region', { name: 'Cần kiểm tra kết quả gửi', exact: true }).waitFor()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.getAttribute('aria-label')), 'Cần kiểm tra kết quả gửi')
    assert.equal(s.writes.length, 1, 'Returning to draft must not resubmit')
  } finally { await s.finish() }
})

test('V12 P2: guest representative email exposes its existing required rule and hint', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/travellers?cruiseId=' + cruiseId)
    await tabTo(p, 'person-0-email')
    const field = p.getByLabel('Email', { exact: true })
    await capture(p, 'guest-email', { ariaRequired: await field.getAttribute('aria-required'), describedBy: await field.getAttribute('aria-describedby') })
    assert.equal(await field.getAttribute('aria-required'), 'true')
    assert.ok((await field.getAttribute('aria-describedby')).includes('person-0-email-hint'))
    assert.equal(await p.locator('#person-0-email-hint').innerText(), 'Bắt buộc cho người đại diện chưa đăng nhập.')
    await p.getByLabel('Họ tên *', { exact: true }).fill('Khách QA development')
    await field.fill('qa@example.test')
    await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Kiểm tra & gửi', exact: true }).waitFor()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Kiểm tra & gửi')
    await tabToText(p, 'Sửa thông tin hành khách')
    await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Hành khách', exact: true }).waitFor()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Hành khách')
    assert.equal(await field.inputValue(), 'qa@example.test')
    await tabTo(p, 'person-0-email')
    await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Kiểm tra & gửi', exact: true }).waitFor()
    await tabToText(p, 'Quay lại')
    await p.keyboard.press('Enter')
    await p.getByRole('heading', { name: 'Hành khách', exact: true }).waitFor()
    assert.equal(await p.evaluate(() => globalThis.document.activeElement.textContent), 'Hành khách')
    assert.equal(await p.getByLabel('Họ tên *', { exact: true }).inputValue(), 'Khách QA development')
    assert.equal(s.writes.length, 0)
  } finally { await s.finish() }
})

test('V12 P2: keyboard focus has a strong visible outline on light Booking backgrounds', { skip: !enabled }, async () => {
  const s = await sandbox(), p = s.page
  try {
    await s.open('/booking/travellers?cruiseId=' + cruiseId)
    await tabTo(p, 'person-0-email')
    const colors = await p.getByLabel('Email', { exact: true }).evaluate(el => ({ outline: globalThis.getComputedStyle(el).outlineColor, background: globalThis.getComputedStyle(el).backgroundColor, width: globalThis.getComputedStyle(el).outlineWidth }))
    const luminance = css => { const values = css.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722 }
    const a = luminance(colors.outline), b = luminance(colors.background), contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    await capture(p, 'focus', { ...colors, contrast })
    assert.ok(contrast >= 3, 'Measured focus contrast is ' + contrast)
    assert.ok(Number.parseFloat(colors.width) >= 3)
  } finally { await s.finish() }
})
