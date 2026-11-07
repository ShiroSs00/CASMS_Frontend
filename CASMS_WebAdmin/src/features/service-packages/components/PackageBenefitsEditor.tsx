import { useCallback, useEffect, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Field, Modal, Notice, Panel } from '@/shared/ui'
import { servicePackageApi, type BenefitKind, type BenefitRow } from '../api/service-package-api'
import { benefitLabels } from '../model/catalog'
import { CatalogState } from './CatalogUI'
import styles from './Catalog.module.css'

const labels = { services: 'Dịch vụ', activities: 'Hoạt động', excursions: 'Tour tham quan trên bờ' }
export function PackageBenefitsEditor({ packageId, status, onChanged }: { packageId: string; status: string; onChanged: () => void }) {
  const access = useSessionAccess()
  const [kind, setKind] = useState<BenefitKind>('services')
  const components = useReadQuery(`package-components:${packageId}:${kind}`, useCallback(signal => servicePackageApi.components(packageId, kind, signal), [packageId, kind]))
  const canOptions = access.canDo(kind === 'services' ? 'SERVICE_READ' : kind === 'activities' ? 'ACTIVITY_READ' : 'EXCURSION_READ')
  const options = useReadQuery(`package-options:${kind}:${canOptions}`, useCallback(signal => canOptions ? servicePackageApi.benefitOptions(kind, signal) : Promise.resolve([]), [kind,canOptions]))
  const [edit, setEdit] = useState<{ method: 'POST' | 'PUT' | 'DELETE'; row?: BenefitRow } | null>(null)
  const [entityId, setEntityId] = useState(''), [benefitType, setBenefitType] = useState<'INCLUDED' | 'OPTIONAL'>('INCLUDED')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null), restoreFocus = useRef(false)
  useEffect(() => {
    if (!restoreFocus.current || busy || edit || components.loading) return
    restoreFocus.current = false
    if (returnFocus.current?.isConnected && !returnFocus.current.matches(':disabled')) returnFocus.current.focus({ preventScroll: true })
  }, [busy, edit, components.loading])
  const allowed = status === 'DRAFT' && access.canDo('PACKAGE_COMPONENT_MANAGE')
  function open(method: 'POST' | 'PUT' | 'DELETE', row?: BenefitRow) { if (row && row.packageId !== packageId) return; returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setEdit({ method, row }); setEntityId(row?.entityId ?? ''); setBenefitType(row?.benefitType ?? 'INCLUDED'); setError('') }
  async function save() {
    if (lock.current || !edit || !allowed || !entityId || (edit.row && edit.row.packageId !== packageId) || (edit.method === 'POST' && !options.data?.some(item => item.id === entityId))) return
    lock.current = true; setBusy(true); setError('')
    try { await servicePackageApi.changeBenefit(packageId, kind, entityId, edit.method, benefitType); restoreFocus.current = true; setEdit(null); components.retry(); onChanged() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được thành phần gói.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Thành phần quyền lợi" >
    <Field htmlFor="package-benefit-kind" label="Nhóm quyền lợi"><select id="package-benefit-kind" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as BenefitKind); setEdit(null) }}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    <CatalogState {...components} /><CatalogState {...options} />
    {components.data?.length === 0 && <Empty title="Chưa có thành phần trong nhóm quyền lợi này" />}
    {Boolean(components.data?.length) && <DataTable label="Thành phần quyền lợi" headers={['Thành phần', 'Quyền lợi', ...(allowed ? ['Thao tác'] : [])]}>
      {components.data?.map(row => <tr key={row.entityId}><td>{options.data?.find(item => item.id === row.entityId)?.name ?? 'Thành phần đã liên kết'} {row.packageId !== packageId && <Badge label="Kế thừa" tone="neutral" />}</td><td><Badge label={benefitLabels[row.benefitType]} tone={row.benefitType === 'INCLUDED' ? 'success' : 'neutral'} /></td>{allowed && <td>{row.packageId !== packageId ? '—' : <div className={styles.detailActions}><Button tone="secondary" size="compact" autoWidth disabled={busy} onClick={() => open('PUT', row)}>Đổi quyền lợi</Button><Button tone="danger" size="compact" autoWidth disabled={busy} onClick={() => open('DELETE', row)}>Gỡ khỏi gói</Button></div>}</td>}</tr>)}
    </DataTable>}
    {allowed && <div className={styles.detailActions}><Button autoWidth disabled={busy || !canOptions || !options.data || !components.data} onClick={() => open('POST')}>Thêm quyền lợi</Button></div>}
    {!canOptions && <p>Chưa có quyền xem danh mục thành phần đã chọn.</p>}
    {edit && access.canDo('PACKAGE_COMPONENT_MANAGE') && <Modal title={edit.method === 'DELETE' ? 'Gỡ thành phần khỏi gói' : 'Cấu hình quyền lợi gói'} busy={busy} protectChanges={edit.method !== 'DELETE'} onClose={() => setEdit(null)} footer={<>
      <Button tone="secondary" data-overlay-dismiss disabled={busy} onClick={() => setEdit(null)}>Hủy</Button>
      <Button tone={edit.method === 'DELETE' ? 'danger' : 'primary'} busy={busy} disabled={!allowed || !entityId} onClick={() => void save()}>{edit.method === 'DELETE' ? 'Gỡ quyền lợi khỏi gói' : edit.method === 'POST' ? 'Thêm quyền lợi' : 'Lưu quyền lợi'}</Button>
    </>}>
      {edit.method === 'POST' ? <Field htmlFor="package-benefit-entity" label={labels[kind]}><select id="package-benefit-entity" value={entityId} disabled={busy} onChange={event => setEntityId(event.target.value)}><option value="">Chọn thành phần có thật</option>{options.data?.filter(item => !components.data?.some(row => row.entityId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <p>{options.data?.find(item => item.id === entityId)?.name ?? 'Thành phần đã chọn'}</p>}
      {edit.method !== 'DELETE' && <Field htmlFor="package-benefit-type" label="Quyền lợi"><select id="package-benefit-type" value={benefitType} disabled={busy} onChange={event => setBenefitType(event.target.value as typeof benefitType)}><option value="INCLUDED">Đã bao gồm</option><option value="OPTIONAL">Tùy chọn</option></select></Field>}
      {error && <Notice tone="error" title="Không cập nhật được">{error}</Notice>}

    </Modal>}
  </Panel>
}
