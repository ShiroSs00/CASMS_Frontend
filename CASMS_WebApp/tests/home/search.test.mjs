import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const ports = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/home/model/asian-ports.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: ports, exports: ports.exports })
const module = { exports: {} }
const source = ts.transpileModule(readFileSync(new URL('../../src/features/home/model/public-booking.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(source, { module, exports: module.exports, require: id => { assert.equal(id, './asian-ports'); return ports.exports } })
const { homeCruiseType, homeCruiseSearch, featuredVoyages } = module.exports
test('Home search accepts only supported public Cruise types; editorial examples carry no sellable dates or rates', () => {
  for (const type of ['ONE_DAY', 'MULTI_DAYS']) {
    assert.equal(homeCruiseType(type), type)
    assert.equal(homeCruiseSearch(type), '/cruises?cruiseType=' + type)
  }
  for (const value of [null, '', 'one_day', 'ALL', 'MULTI_DAYS&page=2', 'https://example.test']) {
    assert.equal(homeCruiseType(value), '')
    assert.equal(homeCruiseSearch(value), '/cruises')
  }
  for (const card of featuredVoyages) {
    assert.equal('price' in card, false)
    assert.equal('cruiseId' in card, false)
    assert.doesNotMatch(card.detail, /\d{2}\/\d{2}\/\d{4}/)
  }
})
