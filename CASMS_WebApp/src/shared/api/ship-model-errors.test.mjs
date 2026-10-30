import test from 'node:test'
import assert from 'node:assert/strict'
import {shipModelErrorMessage as translate} from './ship-model-errors.ts'

test('model response errors retain server paths and filenames in Vietnamese',()=>{
  assert.equal(translate('/ship-model-assets','ZIP entries must be under model-assets/sdasd/v1/'),'Các tệp trong ZIP phải nằm trong thư mục “model-assets/sdasd/v1/”.')
  assert.equal(translate('/ship-model-assets','ZIP is missing manifest asset: decks/main.glb'),'Tệp ZIP thiếu tệp “decks/main.glb” được khai báo trong tệp mô tả mô hình.')
  assert.equal(translate('/ship-model-assets/a/v1/register','Model asset bundle is not uploaded to the database'),'Gói mô hình chưa được tải lên hệ thống.')
})
test('unknown reasons stay visible and other modules retain their error policy',()=>{
  assert.equal(translate('/ships/ship/models/model/imports','Lỗi cụ thể mới từ BE'),'Lỗi cụ thể mới từ BE')
  assert.equal(translate('/bookings','ZIP contains too many files'),undefined)
  assert.equal(translate('/ship-model-assets',''),undefined)
})
