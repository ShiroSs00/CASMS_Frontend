import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const file = new URL('../../src/features/cruises/components/DepartureSchedulePreview.tsx', import.meta.url)
const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 } }).outputText
const jsx = (type, props) => ({ type, props })
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
function render(data, onApply) {
  const key = JSON.stringify(['version', '2026-11-01T08:00', 'context']), state = [{ key, sourceVersionId: 'version', instant: '2026-11-01T01:00:00Z' }, '', key, null]
  let slot = 0
  const module = { exports: {} }, imports = {
    react: { useCallback: fn => fn, useState: () => [state[slot++], () => {}] },
    '@/shared/lib/journey-time': { SHIP_TIME_ZONE: 'Asia/Ho_Chi_Minh' },
    '@/shared/api': { useReadQuery: () => ({ data, loading: false, error: null }) },
    '@/shared/ui': { Button: 'Button', Modal: 'Modal', Notice: 'Notice', Panel: 'Panel' },
    '../api/departure-api': {}, '../model/cruise-validation': {},
    './DepartureData': { ReadState: 'ReadState', ScheduleContents: 'ScheduleContents' },
    './DepartureSchedulePreview.module.css': { default: {} },
  }
  vm.runInNewContext(source, { module, exports: module.exports, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    assert.ok(Object.hasOwn(imports, id), id); return imports[id]
  } })
  const tree = module.exports.DepartureSchedulePreview({ sourceVersionId: 'version', departure: '2026-11-01T08:00', contextKey: 'context', disabled: false, onApply })
  const modal = nodes(tree).find(node => node.type === 'Modal')
  return nodes(modal.props.footer).find(node => node.type === 'Button' && node.props.children === 'Áp dụng lịch này')
}
const schedule = (type = 'SEA_DAY') => ({ sourceVersionRevision: 1, returnDatetime: '2026-11-02T02:00:00Z', departurePortId: null, returnPortId: 'return-port', days: [{ dayNumber: 1, dayType: type, dayRole: 'DEPARTURE', shipTimeZoneId: 'Asia/Ho_Chi_Minh' }] })
test('sea departure preview can be applied without inventing a departure port', () => {
  const data = schedule(); let applied
  const button = render(data, value => { applied = value })
  assert.equal(button.props.disabled, false)
  button.props.onClick()
  assert.equal(applied, data)
  assert.equal(applied.departurePortId, null)
})
test('port departure still requires its port; arrival port and timezone remain mandatory', () => {
  for (const data of [schedule('PORT_DAY'), { ...schedule(), returnPortId: null }, { ...schedule(), sourceVersionRevision: null }, { ...schedule(), days: [{ dayNumber: 1, dayType: 'SEA_DAY', shipTimeZoneId: 'UTC' }] }]) {
    assert.equal(render(data, () => assert.fail('must not apply')).props.disabled, true)
  }
})
