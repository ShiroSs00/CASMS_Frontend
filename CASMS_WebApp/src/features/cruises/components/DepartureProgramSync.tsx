import {Panel,Notice} from '@/shared/ui'
import type {CruiseRecord} from '../model/cruise-record'
import {departureManagementApi} from '../api/departure-management-api'
import {DepartureCommand} from './DepartureCommand'
export function DepartureProgramSync({cruise,onChanged}:{cruise:CruiseRecord;onChanged:()=>void}){
 if(!cruise.sourceVersionId)return null
 return <Panel title="Đồng bộ chương trình từ lịch trình nguồn"><Notice title="Đồng bộ đang chờ hoàn thiện phía hệ thống" tone="warning">Cơ sở giờ tàu và ánh xạ chương trình theo từng lần ghé chưa được xác minh đầy đủ. Chưa thực hiện đồng bộ lại để tránh tạo chương trình sai giờ hoặc sai loại.</Notice><DepartureCommand label="Đồng bộ chương trình vận hành" permissions={['CRUISE_UPDATE_DRAFT','ACTIVITY_UPDATE','EXCURSION_UPDATE']} disabled run={()=>departureManagementApi.sync(cruise.cruiseId)} onChanged={onChanged}/></Panel>
}
