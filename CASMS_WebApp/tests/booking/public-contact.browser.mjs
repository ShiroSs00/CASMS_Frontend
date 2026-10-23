import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import process from 'node:process'
import { URL } from 'node:url'
import path from 'node:path'

const enabled = Boolean(process.env.CASMS_PLAYWRIGHT_MODULE)
const base = process.env.CASMS_PREVIEW_URL || 'http://127.0.0.1:5173'

test('public contact supports hover, keyboard, touch and guest lookup; management login rejects passengers', { skip: !enabled }, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.CASMS_PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(base + '/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/login') return route.fulfill({ json: { success: true, data: { accessToken: 'fixture-only', userId: 'fixture', username: 'fixture', roles: ['PASSENGER'], tokenType: 'Bearer', expiresIn: 3600 } } })
    return route.fulfill({ json: { success: true, data: [] } })
  })
  try {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(base + '/booking/lookup')
      const contact = page.getByRole('button', { name: 'Liên hệ', exact: true })
      const panel = page.getByRole('region', { name: 'Liên hệ OceVie' })
      await contact.hover()
      await panel.waitFor()
      await panel.hover()
      assert.equal(await panel.isVisible(), true)
      assert.match(await panel.innerText(), /09xx 686 888/)
      assert.match(await panel.innerText(), /ocevie.lucky88@gmail.com/)
      assert.equal(await panel.locator('a').count(), 0, 'Unactivated sample channels cannot call or email unrelated owners')
      if (process.env.CASMS_CONTACT_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.CASMS_CONTACT_SCREENSHOTS, `contact-${width}.png`) })
      await contact.focus()
      await page.keyboard.press('Escape')
      await panel.waitFor({ state: 'hidden' })
      await contact.click()
      await panel.waitFor()
      assert.equal(await page.locator('header').getByRole('link', { name: 'Đăng nhập', exact: true }).count(), 0)
      assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true)
      await page.getByRole('heading', { name: 'Tra cứu đặt chỗ', exact: true }).click()
      await panel.waitFor({ state: 'hidden' })
    }
    await page.goto(base + '/my-bookings')
    await page.waitForURL(base + '/booking/lookup')
    await page.getByRole('link', { name: 'Đăng nhập quản trị', exact: true }).click()
    await page.locator('#auth-username').fill('fixture')
    await page.locator('#auth-password').fill('fixture-only')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Hành khách có thể đặt chỗ và tra cứu bằng mã' }).waitFor()
    assert.equal(await page.evaluate(() => globalThis.sessionStorage.getItem('aurora.auth.session.v1')), null)
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
