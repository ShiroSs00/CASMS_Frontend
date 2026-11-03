import {useCallback,useState} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,Field,Notice,Panel} from '@/shared/ui'
import {cruiseApi} from '../api/cruise-api'
import {departureManagementApi as api} from '../api/departure-management-api'
import {DepartureCommand} from './DepartureCommand'
import {ReadState} from './DepartureData'
export function DeparturePackageManager({cruiseId,onChanged}:{cruiseId:string;onChanged:()=>void}){
 const access=useSessionAccess(),allowed=access.canDo('TOUR_PACKAGE_ASSIGN'),[selected,setSelected]=useState('')
 const options=useReadQuery('departure-package-options:'+allowed,useCallback(signal=>allowed?api.packageOptions(signal):Promise.resolve([]),[allowed]))
 const linked=useReadQuery('departure-package-links:'+cruiseId,useCallback(signal=>cruiseApi.listPackages(cruiseId,signal),[cruiseId]))
 const refresh=()=>{linked.retry();options.retry();setSelected('');onChanged()}
 const chosen=options.data?.find(v=>v.id===selected),exists=linked.data?.some(v=>v.tourPackageId===selected)
 return <Panel title="Gói áp dụng cho chuyến khởi hành"><Notice title="Liên kết gói chưa xác nhận quyền bán">Trạng thái áp dụng không đồng nghĩa Quản lý vận hành đã mở bán. Chưa có xác nhận giá, chính sách và phạm vi bán có hiệu lực.</Notice><ReadState {...linked}/>{linked.data&&!linked.data.length&&<p>Chưa có gói được gán.</p>}{linked.data?.map(v=><div key={v.cruiseTourPackageId}><strong>{v.packageName}</strong><p>{v.active?'Đang áp dụng':'Đã ngừng áp dụng'}</p><DepartureCommand key={v.cruiseTourPackageId} label="Gỡ gói khỏi chuyến khởi hành" tone="danger" permissions={['TOUR_PACKAGE_ASSIGN']} run={()=>api.removePackage(cruiseId,v.tourPackageId)} onChanged={refresh} explanation="Gỡ liên kết gói với chuyến khởi hành này; không xóa gói trong danh mục."/></div>)}
 {allowed&&<><ReadState {...options}/><Field htmlFor="departure-package-choice" label="Gói dịch vụ đang hoạt động"><select id="departure-package-choice" value={selected} disabled={options.loading||Boolean(options.error)||linked.loading||Boolean(linked.error)} onChange={e=>setSelected(e.target.value)}><option value="">Chọn gói để áp dụng</option>{options.data?.filter(v=>!linked.data?.some(row=>row.tourPackageId===v.id)).map(v=><option key={v.id} value={v.id}>{v.code} · {v.name}</option>)}</select></Field><DepartureCommand label="Gán gói cho chuyến khởi hành" permissions={['TOUR_PACKAGE_ASSIGN']} disabled={!chosen||exists||!linked.data||Boolean(options.error)||options.loading||linked.loading||Boolean(linked.error)} run={()=>api.assignPackage(cruiseId,selected)} onChanged={refresh} explanation="Gán gói cho chuyến khởi hành không tự xác nhận mở bán hoặc giữ chỗ cho hành khách."/></>}
 {!allowed&&<Notice title="Phần việc của bộ phận được phân quyền">Gói áp dụng được cập nhật bởi tài khoản có quyền phân bổ gói.</Notice>}<Button tone="text" onClick={linked.retry}>Tải lại gói áp dụng</Button>
 </Panel>
}
