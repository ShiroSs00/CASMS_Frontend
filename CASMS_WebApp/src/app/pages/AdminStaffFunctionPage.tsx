import { useParams } from 'react-router'
import { Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { CheckinDesk, FinanceBookingsPage } from '@/features/booking'
import { CruiseOperations } from '@/features/cruises'
import { useCallback, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

function CheckinWorkspace() {
  const access = useSessionAccess(), [cruiseId, setCruiseId] = useState('')
  const allowed = access.has('CRUISE_READ')
  const cruises = useReadQuery(`desk-cruises:${allowed}`, useCallback(async signal => {
    if (!allowed) return []
    const rows: { cruiseId: string; cruiseName: string; cruiseCode: string }[] = []
    for (let page = 0, pages = 1; page < pages; page++) {
      const result = await apiRequest<{ content: typeof rows; totalPages: number }>('/cruise', { signal, query: { page, size: 100 } })
      if (!Array.isArray(result.content) || !Number.isSafeInteger(result.totalPages)) throw new Error('Chưa đọc được danh sách chuyến.')
      rows.push(...result.content); pages = result.totalPages
    }
    return rows
  }, [allowed]))
  return <><CheckinDesk />{allowed && <Panel title="Hướng dẫn an toàn theo chuyến"><Field htmlFor="desk-cruise" label="Hướng dẫn an toàn theo chuyến"><select id="desk-cruise" disabled={cruises.loading || Boolean(cruises.error)} value={cruiseId} onChange={e => setCruiseId(e.target.value)}><option value="">Chọn chuyến</option>{cruises.data?.map(c => <option key={c.cruiseId} value={c.cruiseId}>{c.cruiseCode} · {c.cruiseName}</option>)}</select></Field>{cruises.error && <Notice title="Chưa đọc được chuyến" tone="error">{cruises.error.message}</Notice>}{cruiseId && <CruiseOperations key={cruiseId} cruiseId={cruiseId} />}</Panel>}</>
}

export function AdminStaffFunctionPage() {
  const {area}=useParams()
  if(area==='finance') return <FinanceBookingsPage />
  const label=area==='checkin'?'Làm thủ tục':'Tài chính'
  return <AdminShell><PageHeader breadcrumb="ĐÓN KHÁCH" title={label}  /><CheckinWorkspace /></AdminShell>
}
