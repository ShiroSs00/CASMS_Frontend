import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Modal, Notice } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { catalogActions, catalogPermission } from '../model/catalog-editor'
import { catalogConfig, type CatalogItem, type CatalogKind } from '../model/catalog'
import styles from './Catalog.module.css'

export function CatalogActions({ kind, item, onChanged }: { kind: CatalogKind; item: CatalogItem; onChanged: () => void }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const [action, setAction] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const actions = catalogActions(kind, item.status)
  const spec = actions.find(spec => spec.action === action)
  const canDelete = access.canDo(catalogPermission(kind, 'delete')) && (kind !== 'packages' || item.status === 'DRAFT')
  async function confirm() {
    if (lock.current || !action || (action === 'delete' ? !canDelete : !spec || !access.canDo(spec.permission))) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (action === 'delete') { await servicePackageApi.remove(kind, item.id); navigate(catalogConfig[kind].route) }
      else if (spec) { await servicePackageApi.status(kind, item.id, spec.action); setAction(null); onChanged() }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được danh mục.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!access.canDo(catalogPermission(kind, 'update')) && !access.canDo(catalogPermission(kind, 'delete')) && !actions.some(spec => access.canDo(spec.permission))) return null
  return <div className={styles.detailActions} role="group" aria-label={`Thao tác ${catalogConfig[kind].label.toLocaleLowerCase('vi')}`}>
    {access.canDo(catalogPermission(kind, 'update')) && (kind !== 'packages' || item.status === 'DRAFT') && <ButtonLink tone="secondary" to={`${catalogConfig[kind].route}/${item.id}/edit`}>Chỉnh sửa</ButtonLink>}{' '}
    {actions.map(spec => (access.canDo(spec.permission) ? <Button key={spec.action} disabled={busy || !access.canDo(spec.permission)} onClick={() => { setAction(spec.action); setError('') }}>{spec.label}</Button> : null))}{' '}
    {access.canDo(catalogPermission(kind, 'delete')) && <Button tone="danger" disabled={busy || !canDelete} onClick={() => { setAction('delete'); setError('') }}>Xóa khi chưa sử dụng</Button>}
    {action && (action === 'delete' ? access.canDo(catalogPermission(kind, 'delete')) : spec && access.canDo(spec.permission)) && <Modal title={action === 'delete' ? 'Xác nhận xóa danh mục' : spec?.label ?? 'Cập nhật trạng thái'} busy={busy} onClose={() => setAction(null)}><p>{item.name} · {item.code}. {action === 'delete' ? 'Chỉ xóa bản ghi chưa được sử dụng. Thao tác này không thể hoàn tác.' : 'Thay đổi có thể ảnh hưởng khả năng cung cấp cho yêu cầu hoặc gói dịch vụ.'}</p>{error && <Notice tone="error" title="Không thể cập nhật">{error}</Notice>}<Button tone={action === 'delete' ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>{action === 'delete' ? `Xóa ${catalogConfig[kind].label.toLocaleLowerCase('vi')}` : spec?.label}</Button></Modal>}
  </div>
}
