import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sourceLoader } from '../helpers/source-loader.mjs'

class ApiError extends Error { constructor(message,status,code){super(message);Object.assign(this,{status,code})} }
const duration=sourceLoader()('domain/trip-duration/index.ts')
const pairs=[['SHORT',1],['SHORT',2],['LONG',3],['LONG',4],['LONG',5]]

test('only approved group/day pairs are accepted',()=>{
  for(const [group,days] of pairs) assert.equal(duration.validDurationDays(group,days),true)
  for(const [group,days] of [['SHORT',3],['LONG',6],['LONG',2],['MEDIUM',3],['EXTENDED',5],['SHORT',null],['LONG',3.5]]) assert.equal(duration.validDurationDays(group,days),false)
})

test('existing group-only Trip form and request require no exact day input',async()=>{
  const page=readFileSync(new URL('../../src/features/trip-planning/pages/TripInfoPage.tsx',import.meta.url),'utf8')
  assert.ok(page.includes('id="trip-band"'))
  assert.ok(!page.includes('trip-duration-days'))
  assert.ok(!page.includes("change('durationDays'"))
  const calls=[]
  const api=sourceLoader({'@/shared/api':{ApiError,apiRequest:async(path,options)=>{
    calls.push({path,...options})
    return {tripId:'t',name:options.body.name,status:'DRAFT',revision:1,durationGroup:options.body.durationGroup,durationDays:options.body.durationGroup==='SHORT'?1:3,durationNights:0}
  }}})('features/trip-planning/api/live.ts').liveGateway
  for(const durationBand of ['SHORT','LONG']){
    await api.saveInfo({name:'Trip',description:'',scope:'DOMESTIC',regionIds:['BAC_BO'],countryCodes:[],durationBand},'intent')
    assert.equal(calls.at(-1).body.durationGroup,durationBand)
    assert.equal(Object.hasOwn(calls.at(-1).body,'durationDays'),false)
    assert.equal(Object.hasOwn(calls.at(-1).body,'dayCount'),false)
    assert.equal(calls.at(-1).method,'POST')
  }
})

function sourceReader(trip,days){
  return sourceLoader({'@/shared/api':{ApiError,apiRequest:async path=>path.startsWith('/trips/')?{tripId:'t',tripCode:'T',name:'Source',status:'READY',...trip}:{versionId:'v',tripId:'t',versionNumber:1,revision:2,status:'PUBLISHED',days:days??Array.from({length:trip.durationDays??1},(_,i)=>({dayNumber:i+1})),stops:[],entries:[]}}})('features/cruises/api/source-version.ts').readPublishedSource
}
test('published source inherits exact duration for all valid pairs',async()=>{
  for(const [durationGroup,durationDays] of pairs){
    const value=await sourceReader({durationGroup,durationDays,durationNights:durationDays-1})('v')
    assert.equal(value.durationGroup,durationGroup)
    assert.equal(value.durationDays,durationDays)
    assert.equal(value.durationNights,durationDays-1)
  }
})
test('missing, inconsistent and retired source duration is rejected without fallback',async()=>{
  for(const trip of [{durationDays:1,durationNights:0},{durationGroup:'SHORT',durationNights:0},{durationGroup:'SHORT',durationDays:3,durationNights:2},{durationGroup:'LONG',durationDays:6,durationNights:5},{durationGroup:'MEDIUM',durationDays:3,durationNights:2},{durationGroup:'SHORT',durationDays:1}]){
    await assert.rejects(sourceReader(trip)('v'),e=>e.code==='SOURCE_DURATION_INVALID'&&e.status===422)
  }
  await assert.rejects(sourceReader({durationGroup:'SHORT',durationDays:2,durationNights:1},[{dayNumber:1}])('v'),e=>e.code==='SOURCE_DURATION_INVALID')
  await assert.rejects(sourceReader({durationGroup:'SHORT',durationDays:2,durationNights:1},[{dayNumber:1},{dayNumber:1}])('v'),e=>e.code==='SOURCE_DURATION_INVALID')
})
test('history remains readable without rewriting legacy duration metadata',async()=>{
  const read=sourceReader({durationGroup:'MEDIUM',durationDays:3,durationNights:2})
  const history=await read('v',undefined,true)
  assert.equal(history.durationGroup,'MEDIUM')
  assert.equal(history.durationDays,3)
  await assert.rejects(read('v'),e=>e.code==='SOURCE_DURATION_INVALID')
})
