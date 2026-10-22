import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = new URL('../../src/', import.meta.url)
const jsx = (type, props, key) => ({ type, props, key })
function load(file, imports) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    assert.ok(Object.hasOwn(imports, id), 'Unexpected import: ' + id)
    return imports[id]
  } })
  return module.exports
}

// Exercise the actual router root and BookingProvider with instance-scoped hooks.
// A changed React element identity retires its old state/setters. No API replies,
// credentials or live records are supplied by this lifecycle test.
function sessionHarness() {
  let user = null, active, dirty = false, providerIdentity
  let providerFiber = { values: [] }
  const rootFiber = { values: [] }
  const react = {
    useState(initial) {
      const fiber = active, index = fiber.cursor++
      if (!(index in fiber.values)) fiber.values[index] = typeof initial === 'function' ? initial() : initial
      return [fiber.values[index], value => { fiber.values[index] = typeof value === 'function' ? value(fiber.values[index]) : value; dirty = true }]
    },
    useRef(initial) { const fiber = active, index = fiber.cursor++; return fiber.values[index] ??= { current: initial } },
  }
  const { BookingProvider } = load('features/booking/components/BookingProvider.tsx', {
    react, 'react-router': { Outlet: 'Outlet' },
    '../model/booking-context': { BookingContext: { Provider: 'LegacyContext' } },
    '../model/booking-draft': { initialDraft: () => ({}) },
    '../model/booking-scenarios': { defaultScenario: () => ({}) },
    '../model/live-booking-context': { LiveBookingContext: 'LiveContext', initialLiveBooking: () => ({ passengers: [{ fullName: '' }] }) },
  })
  const layoutFile = 'app/layouts/BookingSessionLayout.tsx'
  const layout = existsSync(new URL(layoutFile, root)) ? load(layoutFile, {
    react, '@/features/auth': { useAuth: () => ({ user }) }, '@/features/booking': { BookingProvider },
  }) : {}
  const featureNames = ['auth', 'booking', 'home', 'suppliers', 'shore-excursions', 'tour-groups', 'cruises', 'operational-issues', 'itineraries', 'regulations', 'ship-deck-cabin', 'activities', 'service-packages']
  const features = Object.fromEntries(featureNames.map(name => ['@/features/' + name, new Proxy({}, { get: (_, key) => key === 'BookingProvider' ? BookingProvider : String(key) })]))
  const { router } = load('app/router.tsx', {
    ...features, 'react-router': { createBrowserRouter: routes => routes, Navigate: 'Navigate' },
    './layouts/PublicLayout': {}, './layouts/AdminAccountLayout': {}, './layouts/BookingSessionLayout': layout,
    './RouteLoading': { RouteLoading: 'RouteLoading' }, './RouteErrorPage': {RouteErrorPage:'RouteErrorPage'},
    './pages/AdminBookingPages': {}, './pages/AdminWorkflowPage': {},
  })
  function stableRender(component, fiber) {
    let tree, turns = 0
    do { dirty = false; fiber.cursor = 0; active = fiber; tree = component(); assert.ok(++turns < 10, 'Render must settle') } while (dirty)
    return tree
  }
  function render() {
    const component = router[0].Component
    let tree = stableRender(component, rootFiber)
    if (component !== BookingProvider) {
      const identity = tree.key
      if (identity !== providerIdentity) { providerIdentity = identity; providerFiber = { values: [] } }
      tree = stableRender(tree.type, providerFiber)
    }
    return tree.props.value
  }
  return { render, signIn: id => { user = id ? { id } : null } }
}

test('guest passenger draft survives sign-in and same-account refresh', () => {
  const app = sessionHarness()
  app.render().setDraft({ passengers: [{ fullName: 'Private draft' }] })
  app.signIn('user-a')
  assert.equal(app.render().draft.passengers[0].fullName, 'Private draft')
  app.signIn('user-a')
  assert.equal(app.render().draft.passengers[0].fullName, 'Private draft')
})

test('logout retires private draft/result and ignores late writes from the retired provider', () => {
  const app = sessionHarness(); app.signIn('user-a')
  const previous = app.render()
  previous.setDraft({ passengers: [{ fullName: 'Private draft' }] })
  previous.setSaved({ bookingReference: 'Private reference' })
  app.signIn(null)
  assert.equal(app.render().draft.passengers[0].fullName, '')
  assert.equal(app.render().saved, null)
  previous.setSaved({ bookingReference: 'Late response' })
  assert.equal(app.render().saved, null)
})

test('switching authenticated accounts starts with an empty Booking context', () => {
  const app = sessionHarness(); app.signIn('user-a')
  app.render().setDraft({ passengers: [{ fullName: 'Other account' }] })
  app.signIn('user-b')
  assert.equal(app.render().draft.passengers[0].fullName, '')
})
