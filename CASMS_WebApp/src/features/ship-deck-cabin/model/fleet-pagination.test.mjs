import test from 'node:test'
import assert from 'node:assert/strict'
import {paginateFleet} from './fleet-pagination.ts'

test('fleet pages show five ships, retain source order and leave totals unchanged',()=>{
 const ships=Array.from({length:12},(_,i)=>({id:i}))
 const before=JSON.stringify(ships)
 assert.deepEqual(paginateFleet(ships,1).items.map(x=>x.id),[0,1,2,3,4])
 assert.deepEqual(paginateFleet(ships,2).items.map(x=>x.id),[5,6,7,8,9])
 assert.deepEqual(paginateFleet(ships,3),{page:3,pages:3,items:[{id:10},{id:11}],start:11,end:12,total:12})
 assert.equal(JSON.stringify(ships),before)
})
test('filtered or refreshed results clamp obsolete pages without hiding remaining ships',()=>{
 assert.equal(paginateFleet([1],3).page,1)
 assert.deepEqual(paginateFleet([1],3).items,[1])
 assert.equal(paginateFleet([1,2],NaN).page,1)
 assert.equal(paginateFleet([1,2],-1).page,1)
 assert.deepEqual(paginateFleet([],9),{page:1,pages:1,items:[],start:0,end:0,total:0})
})
