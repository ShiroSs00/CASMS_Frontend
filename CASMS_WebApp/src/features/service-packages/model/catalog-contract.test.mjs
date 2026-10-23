import test from 'node:test'
import assert from 'node:assert/strict'
import { decodePackageComponents, validateEntitlements } from './catalog-contract.ts'

test('effective benefits preserve ancestor ownership for all component types', () => {
  for (const [kind, field] of [['services', 'serviceId'], ['activities', 'activityId'], ['excursions', 'excursionId']]) {
    const rows = decodePackageComponents([{ packageId: 'parent', [field]: 'inherited', benefitType: 'INCLUDED' }, { packageId: 'child', [field]: 'own', benefitType: 'OPTIONAL' }], kind)
    assert.equal(rows[0].packageId, 'parent')
    assert.equal(rows[1].packageId, 'child')
    assert.equal(rows[0].entityId, 'inherited')
    assert.throws(() => decodePackageComponents([{ packageId: '', [field]: 'bad', benefitType: 'INCLUDED' }], kind))
    assert.throws(() => decodePackageComponents([{ packageId: 'parent', [field]: 'same', benefitType: 'INCLUDED' }, { packageId: 'child', [field]: 'same', benefitType: 'OPTIONAL' }], kind))
  }
})

test('category entitlements accept inherited ownership while rejecting invalid limits', () => {
  const row = { id: 'benefit', packageId: 'parent', categoryId: 'spa', benefitType: 'LIMITED', quantityLimit: 2, discountPercent: null, ownerScope: 'PASSENGER' }
  assert.doesNotThrow(() => validateEntitlements([row]))
  assert.throws(() => validateEntitlements([{ ...row, quantityLimit: -1 }]))
  assert.throws(() => validateEntitlements([{ ...row, discountPercent: 101 }]))
  assert.throws(() => validateEntitlements([{ ...row, benefitType: 'UNKNOWN' }]))
  assert.throws(() => validateEntitlements([row, { ...row, id: 'other' }]))
})
