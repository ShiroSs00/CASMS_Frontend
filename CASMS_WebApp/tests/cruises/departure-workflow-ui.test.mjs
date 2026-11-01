import {loadSource} from '../helpers/source-loader.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

const jsx=(type,props)=>({type,props})
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[]
function load(name,imports) { return loadSource('features/cruises/components/'+name+'.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},...imports}); }
const {DepartureMilestones}=load('DepartureMilestones',{'./Cruises.module.css':{default:{}},'@/shared/i18n/business-copy':{businessCopy:()=> 'Mẫu đã chốt'}})
test('step 3 is an operable review destination and never a sale confirmation',()=>{
 const selected=[]
 const tree=DepartureMilestones({activeStep:2,onStepChange:step=>selected.push(step)})
 const buttons=nodes(tree).filter(node=>node.type==='button')
 assert.equal(buttons.length,2)
 assert.equal(buttons[0].props['aria-current'],'step')
 assert.ok(buttons[1].props.children.includes('Kiểm tra và gửi hồ sơ'))
 buttons[1].props.onClick();assert.deepEqual(selected,[3])
 const review=nodes(DepartureMilestones({activeStep:3,onStepChange:()=>{}})).filter(node=>node.type==='button')
 assert.equal(review[1].props['aria-current'],'step')
 assert.doesNotMatch(JSON.stringify(tree),/xác nhận mở bán/)
})
function source(permissions){let preview=false;const {CruiseSourceDetails}=load('CruiseSourceDetails',{react:{useState:()=>[preview,value=>{preview=value}]},'./InheritedSourcePlan':{SourceScheduleDialog:'SourceScheduleDialog'},'@/shared/ui':{Panel:'Panel',Button:'Button',ButtonLink:'ButtonLink',RecordFacts:'RecordFacts'},'@/shared/auth':{useSessionAccess:()=>({canDo:key=>permissions.includes(key),has:key=>permissions.includes(key)})}});return ()=>CruiseSourceDetails({cruise:{sourceTripId:'trip-1',sourceVersionId:'version-7',sourceTripCode:'TR-1004',sourceVersionNumber:7}})}
test('source actions preserve the exact version, related-departure filter and return destination',()=>{const render=source(['TRIP_READ','CRUISE_READ']);let tree=nodes(render());const preview=tree.find(n=>n.type==='Button'&&n.props.children==='Xem lịch trình đã chốt');assert.ok(preview);preview.props.onClick();tree=nodes(render());const dialog=tree.find(n=>n.type==='SourceScheduleDialog');assert.ok(dialog);assert.equal(dialog.props.versionId,'version-7');assert.equal(typeof dialog.props.onClose,'function');const links=tree.filter(n=>n.type==='ButtonLink');assert.equal(links.length,1);const departures=new URL(links[0].props.to,'https://local.test');assert.equal(departures.pathname,'/admin/cruises');assert.equal(departures.searchParams.get('sourceVersionId'),'version-7');assert.equal(departures.searchParams.get('sourceTripId'),'trip-1')})
test('source navigation is omitted when the corresponding read permission is absent',()=>{const denied=nodes(source([])());assert.equal(denied.filter(n=>n.type==='ButtonLink'||n.type==='Button').length,0);const read=nodes(source(['CRUISE_READ'])());const links=read.filter(n=>n.type==='ButtonLink');assert.equal(links.length,1);assert.equal(read.filter(n=>n.type==='Button').length,0);assert.match(links[0].props.to,/sourceVersionId=version-7/)})
