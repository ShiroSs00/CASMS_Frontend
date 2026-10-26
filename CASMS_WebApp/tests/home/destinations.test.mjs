import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const module = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/home/model/public-destinations.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports })
const { decodeDestinations, destinationPhoto } = module.exports
const row = (name, country = 'VN', id = name) => ({ destinationId:id, destinationName:name, countryCode:country, status:'ACTIVE', ports:[] })

test('destination decoder preserves API names, descriptions, ports and demo records without inserting editorial destinations', () => {
  const data = [row('DEMO Vịnh Hạ Long'), { ...row('Đà Nẵng & Miền Trung'), description:'Từ API', ports:[{portName:'Tiên Sa'}] }, { ...row('Inactive'), status:'INACTIVE' }]
  const decoded = decodeDestinations(data)
  assert.equal(decoded.length, 2)
  assert.ok(decoded.some(item => item.destinationName === 'DEMO Vịnh Hạ Long'))
  assert.equal(decoded.find(item => item.destinationName === 'Đà Nẵng & Miền Trung').description, 'Từ API')
  assert.equal(decoded.find(item => item.destinationName === 'Đà Nẵng & Miền Trung').ports[0].portName, 'Tiên Sa')
  assert.equal(data.length, 3)
  assert.equal(decodeDestinations([]).length, 0)
})

test('destination decoder rejects malformed data and duplicate identities rather than presenting it as empty', () => {
  for (const value of [null, {}, [row('')], [row('Bad','Viet Nam')], [row('Same'), row('Same')], [{...row('Bad'),ports:[{}]}], [{...row('Bad'),description:42}]]) assert.throws(() => decodeDestinations(value))
})

test('demo, test, unknown destinations and wrong-country matches never receive an unrelated photo', () => {
  for (const name of ['demo', 'Demo Tokyo Bay & Kanto', 'TOKYO BAY & KANTO DEMO', '[TEST Aurora] Vịnh Lan Hạ', 'Unknown Bay']) assert.equal(destinationPhoto(row(name, 'JP')), null)
  assert.equal(destinationPhoto(row('Tokyo Bay & Kanto', 'VN')), null)
})

test('six verified destinations map to existing local images; accents and case remain supported', () => {
  for (const [name, country] of [['Tokyo Bay & Kanto','JP'],['Kansai Region','JP'],['Kyushu Island','JP'],['Vịnh Hạ Long & Bắc Bộ','VN'],['ĐÀ NẴNG & MIỀN TRUNG','VN'],['Singapore Marina Hub','SG']]) {
    const photo = destinationPhoto(row(name,country))
    assert.ok(photo, name)
    assert.ok(photo.alt.length > 10)
    assert.ok(existsSync(new URL('../../public'+photo.src, import.meta.url)), photo.src)
  }
})
