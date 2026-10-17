import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptySupplierForm,
  supplierToForm,
  validateSupplierForm,
} from './supplier-form.ts'
import { supplierDateTime, supplierRows } from './supplier-list.ts'

test('validateSupplierForm catches missing required fields', () => {
  const errors = validateSupplierForm(emptySupplierForm)
  assert.equal(errors.supplierName, 'Vui lòng nhập tên nhà cung cấp.')
  assert.equal(errors.contactName, 'Vui lòng nhập tên liên hệ.')
  assert.equal(errors.supplierType, undefined)
  assert.equal(errors.contactPhone, undefined)
  assert.equal(errors.contactEmail, undefined)
  assert.equal(errors.notes, undefined)
})

test('validateSupplierForm accepts valid form values', () => {
  const valid = {
    supplierName: 'Mediterranean Coast Experiences',
    supplierType: 'Local Tour Operator',
    contactName: 'Elena Rossi',
    contactPhone: '+39 06 1234 5678',
    contactEmail: 'elena.rossi@example.com',
    notes: 'Trusted partner for Amalfi coast excursions.',
  }
  const errors = validateSupplierForm(valid)
  assert.deepEqual(errors, {})
})

test('validateSupplierForm validates email format when provided', () => {
  const badEmail = {
    ...emptySupplierForm,
    supplierName: 'Test Supplier',
    contactName: 'Test Contact',
    contactEmail: 'not-an-email',
  }
  const errors = validateSupplierForm(badEmail)
  assert.equal(errors.contactEmail, 'Email không đúng định dạng.')

  const goodEmail = {
    ...emptySupplierForm,
    supplierName: 'Test Supplier',
    contactName: 'Test Contact',
    contactEmail: 'name@example.com',
  }
  const errorsGood = validateSupplierForm(goodEmail)
  assert.equal(errorsGood.contactEmail, undefined)
})

test('validateSupplierForm enforces maximum character limits', () => {
  const longValues = {
    ...emptySupplierForm,
    supplierName: 'a'.repeat(251),
    contactName: 'b'.repeat(201),
    supplierType: 'c'.repeat(101),
    contactPhone: 'd'.repeat(51),
    notes: 'e'.repeat(1001),
  }
  const errors = validateSupplierForm(longValues)
  assert.equal(errors.supplierName, 'Tên nhà cung cấp không được vượt quá 250 ký tự.')
  assert.equal(errors.contactName, 'Tên liên hệ không được vượt quá 200 ký tự.')
  assert.equal(errors.supplierType, 'Loại nhà cung cấp không được vượt quá 100 ký tự.')
  assert.equal(errors.contactPhone, 'Điện thoại không được vượt quá 50 ký tự.')
  assert.equal(errors.notes, 'Ghi chú không được vượt quá 1000 ký tự.')
})

test('supplierToForm maps mock supplier row to form values', () => {
  const mock = supplierRows[0]
  const form = supplierToForm(mock)
  assert.equal(form.supplierName, mock.supplierName)
  assert.equal(form.supplierType, mock.supplierType)
  assert.equal(form.contactName, mock.contactName)
  assert.equal(form.contactEmail, mock.contactEmail)
  assert.equal(form.contactPhone, '+34 600 123 456')
  assert.equal(form.notes, 'Đối tác điều phối tour bờ và hỗ trợ vận hành tại cảng.')
})

test('supplierDateTime formats ISO datetimes and dates properly', () => {
  assert.equal(supplierDateTime('2026-10-17T09:40:00'), '17/10/2026 · 09:40')
  assert.equal(supplierDateTime('2026-10-12T14:20:00'), '12/10/2026 · 14:20')
  assert.equal(supplierDateTime('2026-10-14'), '14/10/2026')
  assert.equal(supplierDateTime(null), '—')
  assert.equal(supplierDateTime(undefined), '—')
})
