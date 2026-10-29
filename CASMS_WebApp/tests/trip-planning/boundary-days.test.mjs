import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const root = new URL('../../src/features/trip-planning/', import.meta.url)
const jsx = (type, props) => ({ type, props })
function load(file, imports = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
  }).outputText, { module, exports: module.exports, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    assert.ok(Object.hasOwn(imports, id), id)
    return imports[id]
  } })
  return module.exports
}
const roles = load('../../domain/itinerary-day/index.ts')
const labels = load('model/day-labels.ts', { '@/domain/itinerary-day': roles })
const { DayPane } = load('components/DayPane.tsx', {
  '@/shared/ui': Object.fromEntries(['Button', 'Field', 'Panel'].map(key => [key, key])),
  '../model/plan': { shortTime: value => value?.slice(0,5)??'Chưa có giờ' }, './SourcePicker': { SourcePicker: 'SourcePicker' }, '../model/day-agenda': { dayAgenda: () => [] },
  '../model/violation-target': { violationTarget: () => null },
  '../Planning.module.css': { default: {} }, '../model/day-labels': labels,
})
const days = count => Array.from({ length: count }, (_, i) => ({ key: `day-${i+1}`, dayNumber: i+1, dayType: 'SEA_DAY', title: '', description: '' }))
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '')
function pane(count, number, extra = {}) {
  const content = { days: days(count), stops: [], entries: [] }
  return DayPane({ content, day: content.days[number-1], editable: true, tab: 'route', busy: false, ...extra })
}

test('boundary roles are separate from sea/port labels, including one-day trips', () => {
  assert.equal(labels.scheduleDayTypeLabel(1, 3, 'SEA_DAY'), 'Ngày khởi hành · Trên biển')
  assert.equal(labels.scheduleDayTypeLabel(3, 3, null), 'Ngày kết thúc · Chưa chọn trạng thái')
  assert.equal(labels.scheduleDayTypeLabel(1, 1, 'PORT_DAY'), 'Ngày khởi hành và kết thúc · Cảng trả khách')
  assert.equal(labels.scheduleDayTypeLabel(2, 3, 'SEA_DAY'), 'Ngày trên biển')
  assert.equal(labels.scheduleDayTypeLabel(2, 3, 'PORT_DAY'), 'Ngày ghé cảng')
})

test('saving boundary days keeps the supported API type and preserves interior choices and source data', () => {
  const original = days(5)
  original[2].dayType = null
  const before = JSON.stringify(original)
  const result = labels.normalizeBoundaryDays(original)
  assert.equal(result[0].dayType, 'SEA_DAY')
  assert.equal(result[0].dayRole, 'DEPARTURE')
  assert.equal(result[4].dayRole, 'ARRIVAL')
  assert.equal(result[2].dayRole, 'REGULAR')
  assert.equal(result[4].dayType, 'PORT_DAY')
  assert.equal(result[1].dayType, 'SEA_DAY')
  assert.equal(result[2].dayType, null)
  assert.equal(original[0].dayType, 'SEA_DAY')
  assert.equal(JSON.stringify(original), before)
  assert.equal(labels.normalizeBoundaryDays(days(1))[0].dayType, 'PORT_DAY')
  assert.equal(labels.normalizeBoundaryDays([]).length, 0)
})

test('departure day lets the manager choose sea or shore, with no port prompt at sea', () => {
  const tree = pane(3, 1), all = nodes(tree)
  const select = all.find(node => node.type === 'select' && node.props.id === 'planning-day-type')
  assert.ok(select)
  assert.ok(text(select).includes('Ngày trên biển'))
  assert.ok(text(select).includes('Xuống bờ'))
  assert.ok(!all.some(node => node.type === 'Button' && text(node).startsWith('Thêm cảng')))
  const content = { days: days(3), stops: [], entries: [] }
  content.days[0].dayType = 'PORT_DAY'
  assert.ok(nodes(DayPane({ content, day: content.days[0], editable: true, tab: 'route', busy: false })).some(node => node.type === 'Button' && text(node) === 'Thêm cảng khởi hành'))
})

for (const [count, number] of [[3, 3], [1, 1]]) {
  test(`${count} days / day ${number}: ending only allows a disembarkation port`, () => {
    const content = { days: labels.normalizeBoundaryDays(days(count)), stops: [], entries: [] }
    const tree = pane(count, number, { content, day: content.days[number-1] }), all = nodes(tree)
    assert.ok(!all.some(node => node.type === 'select' && node.props.id === 'planning-day-type'))
    assert.ok(all.some(node => node.type === 'input' && node.props.id === 'planning-day-type' && node.props.readOnly && node.props.value === 'Cảng trả khách'))
    assert.ok(all.some(node => node.type === 'Button' && text(node).startsWith('Thêm cảng')))
  })
}

test('interior days retain the sea/port selector and busy state', () => {
  const select = nodes(pane(3, 2, { busy: true })).find(node => node.type === 'select')
  assert.ok(select.props.disabled)
  assert.ok(text(select).includes('Ngày trên biển'))
  assert.ok(text(select).includes('Ngày ghé cảng'))
})

test('read-only and program views show boundary roles without edit controls', () => {
  for (const extra of [{ editable: false }, { editable: false, tab: 'program' }]) {
    const tree = pane(3, 3, extra)
    assert.ok(text(tree).includes('Ngày kết thúc'))
    assert.ok(!nodes(tree).some(node => node.type === 'select'))
    assert.ok(!nodes(tree).some(node => node.type === 'Button' && text(node).startsWith('Thêm cảng')))
  }
})

test('changing the trip length recalculates the boundary role without erasing the former final day', () => {
  const two = labels.normalizeBoundaryDays(days(2))
  const three = labels.normalizeBoundaryDays([...two, { ...days(3)[2] }])
  assert.equal(labels.scheduleDayTypeLabel(2, three.length, three[1].dayType), 'Ngày ghé cảng')
  assert.equal(labels.scheduleDayTypeLabel(3, three.length, three[2].dayType), 'Ngày kết thúc · Cảng trả khách')
  assert.equal(labels.scheduleDayTypeLabel(2, two.length, two[1].dayType), 'Ngày kết thúc · Cảng trả khách')
})

test('content request sends BE dayRole separately from sea/port state', () => {
  const { contentRequest } = load('api/mappers.ts', {
    '@/domain/itinerary-day': roles, './gateway': { PlanningFault: Error },
    '../model/plan': { SHIP_ZONE: 'Asia/Ho_Chi_Minh' }, '../model/duration': {},
  })
  const content = { days: labels.normalizeBoundaryDays(days(3)), stops: [], entries: [] }
  content.days[0].departurePortId='origin'
  content.days[0].plannedDepartureTime='08:15'
  const request = contentRequest({ revision: 7 }, content)
  assert.equal(request.expectedRevision, 7)
  assert.equal(request.days[0].dayRole, 'DEPARTURE')
  assert.equal(request.days[0].dayType, 'SEA_DAY')
  assert.equal(request.days[0].departurePortId, 'origin')
  assert.equal(request.days[0].plannedDepartureTime, '08:15:00')
  assert.equal(request.days[2].dayRole, 'ARRIVAL')
  assert.equal(request.days[2].dayType, 'PORT_DAY')
})

test('origin port and clock remain editable for both sea and port departure states', () => {
  for (const dayType of ['SEA_DAY','PORT_DAY']) {
    const content = { days: labels.normalizeBoundaryDays(days(3)), stops: [], entries: [] }
    content.days[0] = { ...content.days[0], dayType, departurePortId: 'origin', departurePortName: 'Cảng đi', plannedDepartureTime: '08:15:30' }
    let change
    const tree = DayPane({ content, day: content.days[0], editable: true, tab: 'route', busy: false, departurePorts: { data: [{id:'origin',label:'Cảng đi'}],loading:false,error:'',retry(){} },onDeparture: value => { change=value } })
    const all = nodes(tree), picker = all.find(node => node.type === 'SourcePicker'), clock = all.find(node => node.props?.id === 'planning-departure-time' && node.type === 'input')
    assert.equal(picker.props.value, 'origin')
    assert.equal(clock.props.value, '08:15:30')
    assert.equal(clock.props.disabled, false)
    clock.props.onChange({target:{value:'09:00:00'}})
    assert.equal(change.plannedDepartureTime,'09:00:00')
    assert.ok(!nodes(pane(3,2)).some(node=>node.props?.id==='planning-departure-time'))
  }
})
