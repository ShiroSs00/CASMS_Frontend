import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Modal, Notice, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { catalogActions, catalogPermission } from '../model/catalog-editor'
import { catalogConfig, type CatalogItem, type CatalogKind } from '../model/catalog'

export function CatalogActions({ kind, item, onChanged }: { kind: CatalogKind; item: CatalogItem; onChanged: () => void }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const [action, setAction] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const actions = catalogActions(kind, item.status)
  const spec = actions.find(spec => spec.action === action)
  const canDelete = access.has(catalogPermission(kind, 'delete')) && (kind !== 'packages' || item.status === 'DRAFT')
  async function confirm() {
    if (lock.current || !action || (action === 'delete' ? !canDelete : !spec || !access.has(spec.permission))) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (action === 'delete') { await servicePackageApi.remove(kind, item.id); navigate(catalogConfig[kind].route) }
      else if (spec) { await servicePackageApi.status(kind, item.id, spec.action); setAction(null); onChanged() }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được danh mục.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Quản lý danh mục">
    {access.has(catalogPermission(kind, 'update')) && (kind !== 'packages' || item.status === 'DRAFT') && <ButtonLink tone="secondary" to={`${catalogConfig[kind].route}/${item.id}/edit`}>Chỉnh sửa</ButtonLink>}{' '}
    {actions.map(spec => <Button key={spec.action} tone="secondary" disabled={busy || !access.has(spec.permission)} onClick={() => { setAction(spec.action); setError('') }}>{spec.label}</Button>)}{' '}
    <Button tone="danger" disabled={busy || !canDelete} onClick={() => { setAction('delete'); setError('') }}>Xóa khi chưa sử dụng</Button>
    {action && <Modal title={action === 'delete' ? 'Xác nhận xóa danh mục' : spec?.label ?? 'Cập nhật trạng thái'} busy={busy} onClose={() => setAction(null)}><p>{item.name} · {item.code}. {action === 'delete' ? 'Chỉ xóa bản ghi chưa được sử dụng. Thao tác này không thể hoàn tác.' : 'Thay đổi có thể ảnh hưởng khả năng cung cấp cho yêu cầu hoặc gói dịch vụ.'}</p>{error && <Notice tone="error" title="Không thể cập nhật">{error}</Notice>}<Button tone={action === 'delete' ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>Xác nhận</Button></Modal>}
  </Panel>
}
