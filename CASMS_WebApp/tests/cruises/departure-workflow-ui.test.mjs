import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const jsx=(type,props)=>({type,props})
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[]
function load(name,imports){
 const module={exports:{}}
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/features/cruises/components/'+name+'.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,URLSearchParams,require:key=>{
  if(key==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'}
  assert.ok(Object.hasOwn(imports,key),key);return imports[key]
 }})
 return module.exports
}
const {DepartureMilestones}=load('DepartureMilestones',{'./Cruises.module.css':{default:{}},'@/shared/i18n/business-copy':{businessCopy:()=> 'Mẫu đã chốt'}})
test('step 3 is an operable review destination and never a sale confirmation',()=>{
 const selected=[]
 const tree=DepartureMilestones({activeStep:2,onStepChange:step=>selected.push(step)})
 const buttons=nodes(tree).filter(node=>node.type==='button')
 assert.equal(buttons.length,2)
 assert.equal(buttons[0].props['aria-current'],'step')
 assert.ok(buttons[1].props.children.includes('Kiểm tra và gửi duyệt'))
 buttons[1].props.onClick();assert.deepEqual(selected,[3])
 const review=nodes(DepartureMilestones({activeStep:3,onStepChange:()=>{}})).filter(node=>node.type==='button')
 assert.equal(review[1].props['aria-current'],'step')
 assert.doesNotMatch(JSON.stringify(tree),/xác nhận mở bán/)
})
const source=(permissions)=>load('CruiseSourceDetails',{
 'react-router':{useLocation:()=>({pathname:'/admin/cruises/cruise-1',search:'?section=overview'})},
 '@/shared/ui':{Panel:'Panel',ButtonLink:'ButtonLink',RecordFacts:'RecordFacts'},
 '@/shared/auth':{useSessionAccess:()=>({canDo:key=>permissions.includes(key),has:key=>permissions.includes(key)})},
 '@/shared/i18n/business-copy':{businessCopy:()=> 'Mẫu đang áp dụng'},
 './DeparturePreparation.module.css':{default:{}},
}).CruiseSourceDetails({cruise:{sourceTripId:'trip-1',sourceVersionId:'version-7',sourceTripCode:'TR-1004',sourceVersionNumber:7}})
test('source actions preserve the exact version, related-departure filter and return destination',()=>{
 const links=nodes(source(['TRIP_READ','CRUISE_READ'])).filter(node=>node.type==='ButtonLink')
 assert.equal(links.length,2)
 const template=new URL(links[0].props.to,'https://local.test')
 assert.equal(template.pathname,'/admin/trips/trip-1/schedule')
 assert.equal(template.searchParams.get('versionId'),'version-7')
 assert.equal(template.searchParams.get('returnTo'),'/admin/cruises/cruise-1?section=overview')
 const departures=new URL(links[1].props.to,'https://local.test')
 assert.equal(departures.searchParams.get('sourceVersionId'),'version-7')
 assert.equal(departures.searchParams.get('sourceTripId'),'trip-1')
})
test('source navigation is omitted when the corresponding read permission is absent',()=>{
 assert.equal(nodes(source([])).filter(node=>node.type==='ButtonLink').length,0)
 const links=nodes(source(['CRUISE_READ'])).filter(node=>node.type==='ButtonLink')
 assert.equal(links.length,1)
 assert.match(links[0].props.to,/sourceVersionId=version-7/)
})
