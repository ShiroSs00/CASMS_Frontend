import assert from 'node:assert/strict'
import test from 'node:test'
import { toPublishedCruise, toPublishedPage } from './live-cruise-contract.ts'

const published = {
  cruiseId:'3fa85f64-5717-4562-b3fc-2c963f66afa6',
  cruiseCode:'CR-2026-001', cruiseName:'Hải trình Vịnh Hạ Long',
  shipId:'3fa85f64-5717-4562-b3fc-2c963f66afa7', shipName:'Ocean Voyager', cruiseType:'MULTI_DAYS',
  departureDatetime:'2026-11-20T02:00:00Z', returnDatetime:'2026-11-22T08:00:00Z',
  departurePortName:'Tuần Châu', returnPortName:'Hạ Long', status:'PUBLISHED',
}

test('published cruise mapping keeps only catalog facts, never fare or availability',()=>{
  const cruise=toPublishedCruise(published)
  assert.equal(cruise?.title,published.cruiseName)
  assert.equal(cruise?.shipId,published.shipId)
  assert.equal(cruise?.departurePort,'Tuần Châu')
  assert.equal(cruise?.returnAt,published.returnDatetime)
  assert.equal('price' in cruise, false)
  assert.equal('available' in cruise, false)
  assert.equal(toPublishedCruise({...published,status:'DRAFT'}),null)
})

test('Spring pages preserve server pagination and reject untrusted rows',()=>{
  const page=toPublishedPage({content:[published],number:1,totalPages:3,totalElements:13})
  assert.equal(page.page,2)
  assert.equal(page.pageCount,3)
  assert.equal(page.total,13)
  assert.equal(page.items.length,1)
  assert.deepEqual(toPublishedPage({content:[],number:0,totalPages:0,totalElements:0}),{items:[],page:1,pageCount:1,total:0})
  assert.throws(()=>toPublishedPage({content:[{...published,status:'DRAFT'}],number:0,totalPages:1,totalElements:1}),/PUBLISHED/)
  assert.throws(()=>toPublishedPage({content:[],number:-1,totalPages:1,totalElements:0}),/Phân trang/)
  assert.throws(()=>toPublishedPage({content:[published],number:0,totalPages:0,totalElements:0}),/Phân trang/)
  assert.throws(()=>toPublishedCruise({...published,departureDatetime:'not-a-date'}),/departureDatetime/)
  assert.throws(()=>toPublishedCruise({...published,shipId:'invalid'}),/shipId/)
})
