import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Modal, Notice, Panel } from '@/shared/ui'
import { servicePackageApi, type BenefitKind, type BenefitRow } from '../api/service-package-api'
import { benefitLabels } from '../model/catalog'
import { CatalogState } from './CatalogUI'

const labels = { services: 'Dịch vụ', activities: 'Hoạt động', excursions: 'Tham quan bờ' }
export function PackageBenefitsEditor({ packageId, status, onChanged }: { packageId: string; status: string; onChanged: () => void }) {
  const access = useSessionAccess()
  const [kind, setKind] = useState<BenefitKind>('services')
  const components = useReadQuery(`package-components:${packageId}:${kind}`, useCallback(signal => servicePackageApi.components(packageId, kind, signal), [packageId, kind]))
  const canOptions = access.has(kind === 'services' ? 'SERVICE_READ' : kind === 'activities' ? 'ACTIVITY_READ' : 'EXCURSION_READ')
  const options = useReadQuery(`package-options:${kind}:${canOptions}`, useCallback(signal => canOptions ? servicePackageApi.benefitOptions(kind, signal) : Promise.resolve([]), [kind,canOptions]))
  const [edit, setEdit] = useState<{ method: 'POST' | 'PUT' | 'DELETE'; row?: BenefitRow } | null>(null)
  const [entityId, setEntityId] = useState(''), [benefitType, setBenefitType] = useState<'INCLUDED' | 'OPTIONAL'>('INCLUDED')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const allowed = status === 'DRAFT' && access.has('PACKAGE_COMPONENT_MANAGE')
  function open(method: 'POST' | 'PUT' | 'DELETE', row?: BenefitRow) { if (row && row.packageId !== packageId) return; setEdit({ method, row }); setEntityId(row?.entityId ?? ''); setBenefitType(row?.benefitType ?? 'INCLUDED'); setError('') }
  async function save() {
    if (lock.current || !edit || !allowed || !entityId || (edit.row && edit.row.packageId !== packageId) || (edit.method === 'POST' && !options.data?.some(item => item.id === entityId))) return
    lock.current = true; setBusy(true); setError('')
    try { await servicePackageApi.changeBenefit(packageId, kind, entityId, edit.method, benefitType); setEdit(null); components.retry(); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được thành phần gói.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Thành phần quyền lợi" subtitle="Quyền lợi gói không tự giữ chỗ trong dịch vụ, hoạt động hoặc chuyến tham quan.">
    <Field htmlFor="package-benefit-kind" label="Nhóm quyền lợi"><select id="package-benefit-kind" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as BenefitKind); setEdit(null) }}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <CatalogState {...components} /><CatalogState {...options} />
    {components.data?.length === 0 && <Empty title="Chưa có thành phần trong nhóm quyền lợi này" />}
    <ul>{components.data?.map(row => <li key={row.entityId}><strong>{options.data?.find(item => item.id === row.entityId)?.name ?? 'Thành phần đã liên kết'}</strong> · {benefitLabels[row.benefitType]}{' '}{row.packageId !== packageId ? <span>· Kế thừa từ gói cha; chỉnh sửa tại gói nguồn.</span> : <>{access.has('PACKAGE_COMPONENT_MANAGE') && <Button tone="text" disabled={!allowed || busy} onClick={() => open('PUT', row)}>Đổi quyền lợi</Button>}{access.has('PACKAGE_COMPONENT_MANAGE') && <Button tone="text" disabled={!allowed || busy} onClick={() => open('DELETE', row)}>Gỡ khỏi gói</Button>}</>}</li>)}</ul>
    {access.has('PACKAGE_COMPONENT_MANAGE') && <Button disabled={!allowed || busy || !canOptions || !options.data || !components.data} onClick={() => open('POST')}>Thêm quyền lợi</Button>}
    {!canOptions && <p>Chưa có quyền xem danh mục thành phần đã chọn.</p>}
    {access.has('PACKAGE_COMPONENT_MANAGE') && status !== 'DRAFT' && <p>Chỉ gói nháp chưa được phân bổ mới được thay đổi thành phần.</p>}
    {edit && access.has('PACKAGE_COMPONENT_MANAGE') && <Modal title={edit.method === 'DELETE' ? 'Gỡ thành phần khỏi gói' : 'Cấu hình quyền lợi gói'} busy={busy} onClose={() => setEdit(null)}>
      {edit.method === 'POST' ? <Field htmlFor="package-benefit-entity" label={labels[kind]}><select id="package-benefit-entity" value={entityId} disabled={busy} onChange={event => setEntityId(event.target.value)}><option value="">Chọn thành phần có thật</option>{options.data?.filter(item => !components.data?.some(row => row.entityId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <p>{options.data?.find(item => item.id === entityId)?.name ?? 'Thành phần đã chọn'}</p>}
      {edit.method !== 'DELETE' && <Field htmlFor="package-benefit-type" label="Quyền lợi"><select id="package-benefit-type" value={benefitType} disabled={busy} onChange={event => setBenefitType(event.target.value as typeof benefitType)}><option value="INCLUDED">Đã bao gồm</option><option value="OPTIONAL">Tùy chọn</option></select></Field>}
      <p>Xác nhận thay đổi thành phần gói. Thao tác không đăng ký chỗ hoặc thay đổi trạng thái chuyến tham quan.</p>
      {error && <Notice tone="error" title="Không cập nhật được">{error}</Notice>}
      <Button tone={edit.method === 'DELETE' ? 'danger' : 'primary'} disabled={busy || !allowed || !entityId} onClick={() => void save()}>Xác nhận</Button>
    </Modal>}
  </Panel>
}
