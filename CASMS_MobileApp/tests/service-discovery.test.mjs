import assert from 'node:assert/strict';
import test from 'node:test';
import { filterServiceGuides } from '../src/features/services/service-model.ts';

test('service discovery supports accented and unaccented Vietnamese search', () => {
  for (const query of ['ẩm thực', 'am thuc', '  AM THUC  ']) {
    assert.deepEqual(filterServiceGuides('all', query).map(item => item.id), ['dining']);
  }
  assert.deepEqual(filterServiceGuides('all', 'CHĂM SÓC').map(item => item.id), ['wellness']);
});

test('category and search are combined and unmatched queries produce an empty result', () => {
  assert.equal(filterServiceGuides('wellness', 'am thuc').length, 0);
  assert.equal(filterServiceGuides('all', 'khong co dich vu nay').length, 0);
  assert.deepEqual(filterServiceGuides('experience', '').map(item => item.id), ['shore', 'onboard']);
  assert.equal(filterServiceGuides('all', '  ').length, 4);
});
