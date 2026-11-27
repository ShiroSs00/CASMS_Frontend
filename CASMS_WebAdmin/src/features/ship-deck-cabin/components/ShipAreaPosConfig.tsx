import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { Button, DataTable, Empty, Field, Loading, Notice } from '@/shared/ui'
import { serviceAreaName, serviceType } from '@/shared/i18n/service-area-copy'
import type { ServiceArea } from '../api/ship-areas-api'
import styles from './ShipAreas.module.css'

type ServiceOption = { id: string; name: string; code?: string; status?: string }
type AreaServiceRow = { areaId: string; serviceId: string; permissions: string[]; enabled: boolean; inherited: boolean }
type PosTerminalRow = { terminalId: string; shipId: string; areaId: string; code: string; name: string; permissions: string[]; enabled: boolean }
type PosCredential = { terminal: PosTerminalRow; deviceSecret: string }

const DEFAULT_POS_PERMISSIONS = [
  'SERVICE_READ',
  'SERVICE_SALE',
  'SERVICE_REQUEST_READ',
  'SERVICE_REQUEST_ASSIGN',
  'SERVICE_REQUEST_EXECUTE',
  'ACTIVITY_READ',
  'ACTIVITY_REGISTRATION',
  'ACTIVITY_ATTENDANCE',
]

const areaLabel = (area: ServiceArea) =>
  serviceAreaName({ name: area.name ?? (area.kind ? serviceType(area.kind) : 'Khu vực chưa đặt tên'), kind: area.kind ?? '' })

export function ShipAreaPosConfig({
  shipId,
  deckId,
  areasOnDeck,
  allAreas,
}: {
  shipId: string
  deckId: string
  areasOnDeck: ServiceArea[]
  allAreas: ServiceArea[]
}) {
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [areaBusy, setAreaBusy] = useState(false)
  const [areaError, setAreaError] = useState('')
  const [areaSuccess, setAreaSuccess] = useState('')

  const [posAreaId, setPosAreaId] = useState('')
  const [posCode, setPosCode] = useState('')
  const [posName, setPosName] = useState('')
  const [posBusy, setPosBusy] = useState(false)
  const [posError, setPosError] = useState('')
  const [createdSecret, setCreatedSecret] = useState<{ code: string; name: string; secret: string } | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const lock = useRef(false)

  const activeAreaId = areasOnDeck.some(a => a.id === selectedAreaId) ? selectedAreaId : ''
  const activePosAreaId = areasOnDeck.some(a => a.id === posAreaId) ? posAreaId : ''

  const servicesQuery = useReadQuery(
    'ship-pos-services-catalog',
    useCallback(async signal => {
      const rows = await apiRequest<ServiceOption[]>('/servicepackage/services', { signal })
      return Array.isArray(rows) ? rows.filter(r => r && r.id && (!r.status || r.status === 'ACTIVE')) : []
    }, []),
  )

  const areaServicesQuery = useReadQuery(
    `ship-area-services:${shipId}:${activeAreaId}`,
    useCallback(
      async signal => {
        if (!activeAreaId) return [] as AreaServiceRow[]
        return apiRequest<AreaServiceRow[]>(
          `/ships/${encodeURIComponent(shipId)}/areas/${encodeURIComponent(activeAreaId)}/services`,
          { signal },
        )
      },
      [shipId, activeAreaId],
    ),
  )

  const terminalsQuery = useReadQuery(
    `ship-pos-terminals:${shipId}`,
    useCallback(
      signal => apiRequest<PosTerminalRow[]>(`/ships/${encodeURIComponent(shipId)}/pos-terminals`, { signal }),
      [shipId],
    ),
  )

  const serviceNameById = new Map((servicesQuery.data ?? []).map(s => [s.id, s.name]))
  const areaById = new Map(allAreas.map(a => [a.id, a]))
  const assignedIds = new Set((areaServicesQuery.data ?? []).map(r => r.serviceId))
  const availableServices = (servicesQuery.data ?? []).filter(s => !assignedIds.has(s.id))

  async function assignService() {
    if (lock.current || !activeAreaId || !serviceId) return
    lock.current = true
    setAreaBusy(true)
    setAreaError('')
    setAreaSuccess('')
    try {
      await apiRequest(
        `/ships/${encodeURIComponent(shipId)}/areas/${encodeURIComponent(activeAreaId)}/services/${encodeURIComponent(serviceId)}`,
        { method: 'PUT', body: { permissions: null, enabled: true } },
      )
      setServiceId('')
      setAreaSuccess('Đã gắn dịch vụ vào khu vực 3D và đồng bộ lên boong.')
      areaServicesQuery.retry()
    } catch (reason) {
      setAreaError(reason instanceof ApiError ? reason.message : 'Chưa gắn được dịch vụ vào khu vực.')
    } finally {
      lock.current = false
      setAreaBusy(false)
    }
  }

  async function unassignService(targetServiceId: string) {
    if (lock.current || !activeAreaId) return
    lock.current = true
    setAreaBusy(true)
    setAreaError('')
    setAreaSuccess('')
    try {
      await apiRequest(
        `/ships/${encodeURIComponent(shipId)}/areas/${encodeURIComponent(activeAreaId)}/services/${encodeURIComponent(targetServiceId)}`,
        { method: 'DELETE' },
      )
      setAreaSuccess('Đã gỡ dịch vụ khỏi khu vực 3D.')
      areaServicesQuery.retry()
    } catch (reason) {
      setAreaError(reason instanceof ApiError ? reason.message : 'Chưa gỡ được dịch vụ khỏi khu vực.')
    } finally {
      lock.current = false
      setAreaBusy(false)
    }
  }

  async function createTerminal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !activePosAreaId || !posCode.trim() || !posName.trim()) return
    lock.current = true
    setPosBusy(true)
    setPosError('')
    setCreatedSecret(null)
    try {
      const result = await apiRequest<PosCredential>(`/ships/${encodeURIComponent(shipId)}/pos-terminals`, {
        method: 'POST',
        body: {
          areaId: activePosAreaId,
          code: posCode.trim(),
          name: posName.trim(),
          permissions: DEFAULT_POS_PERMISSIONS,
          enabled: true,
        },
      })
      setCreatedSecret({
        code: result.terminal.code,
        name: result.terminal.name,
        secret: result.deviceSecret,
      })
      setCopiedSecret(false)
      setPosCode('')
      setPosName('')
      terminalsQuery.retry()
    } catch (reason) {
      setPosError(reason instanceof ApiError ? reason.message : 'Chưa đăng ký được máy POS offline.')
    } finally {
      lock.current = false
      setPosBusy(false)
    }
  }

  return (
    <div className={styles.configGrid}>
      <section className={styles.configCard} aria-label="Gắn dịch vụ cho khu vực 3D">
        <div className={styles.configHeader}>
          <h3>Gắn dịch vụ vào khu vực 3D</h3>
          <p className={styles.configHint}>
            Chọn khu vực trên boong để khai báo dịch vụ phục vụ tại đây. Hệ thống tự đồng bộ lên boong tương ứng để bước Phương án nhân sự mở được khu vực.
          </p>
        </div>

        {!deckId ? (
          <p className={styles.configHint}>Chọn một boong ở phía trên để cấu hình dịch vụ cho khu vực 3D.</p>
        ) : areasOnDeck.length === 0 ? (
          <p className={styles.configHint}>Boong này chưa có khu vực dịch vụ trong mô hình 3D.</p>
        ) : (
          <div className={styles.stack}>
            <div className={styles.filters}>
              <Field htmlFor="area-pos-select-area" label="Khu vực 3D trên boong">
                <select
                  id="area-pos-select-area"
                  value={activeAreaId}
                  disabled={areaBusy}
                  onChange={e => {
                    setSelectedAreaId(e.target.value)
                    setServiceId('')
                    setAreaError('')
                    setAreaSuccess('')
                  }}
                >
                  <option value="">Chọn khu vực 3D</option>
                  {areasOnDeck.map(area => (
                    <option key={area.id} value={area.id}>
                      {areaLabel(area)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field htmlFor="area-pos-select-service" label="Dịch vụ áp dụng">
                <select
                  id="area-pos-select-service"
                  value={serviceId}
                  disabled={areaBusy || !activeAreaId || servicesQuery.loading}
                  onChange={e => setServiceId(e.target.value)}
                >
                  <option value="">{servicesQuery.loading ? 'Đang tải dịch vụ…' : 'Chọn dịch vụ để gắn'}</option>
                  {availableServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div>
              <Button busy={areaBusy} disabled={!activeAreaId || !serviceId} onClick={() => void assignService()}>
                Gắn dịch vụ vào khu vực
              </Button>
            </div>

            {areaError && (
              <Notice title="Chưa cập nhật được dịch vụ khu vực" tone="error">
                {areaError}
              </Notice>
            )}
            {areaSuccess && (
              <Notice title="Đã cập nhật dịch vụ khu vực" tone="success">
                {areaSuccess}
              </Notice>
            )}

            {activeAreaId && areaServicesQuery.loading && <Loading label="Đang tải dịch vụ đã gắn…" />}
            {activeAreaId && areaServicesQuery.error && (
              <Notice title="Không tải được dịch vụ của khu vực" tone="error">
                <Button tone="secondary" onClick={areaServicesQuery.retry}>
                  Thử lại
                </Button>
              </Notice>
            )}
            {activeAreaId && areaServicesQuery.data && (
              areaServicesQuery.data.length > 0 ? (
                <ul className={styles.assignedList}>
                  {areaServicesQuery.data.map(row => (
                    <li key={row.serviceId} className={styles.assignedRow}>
                      <span>{serviceNameById.get(row.serviceId) ?? row.serviceId}</span>
                      <Button tone="text" disabled={areaBusy} onClick={() => void unassignService(row.serviceId)}>
                        Gỡ
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.configHint}>Khu vực này chưa được gắn dịch vụ nào.</p>
              )
            )}
          </div>
        )}
      </section>

      <section className={styles.configCard} aria-label="Máy POS offline trên tàu">
        <div className={styles.configHeader}>
          <h3>Máy POS offline trên tàu</h3>
          <p className={styles.configHint}>
            Đăng ký các thiết bị POS vật lý đặt tại khu vực dịch vụ. Khi lập Kế hoạch chuyến, Quản lý tàu sẽ chọn máy POS nào mở hoạt động cho từng khu vực.
          </p>
        </div>

        {terminalsQuery.loading && !terminalsQuery.data && <Loading label="Đang tải danh sách máy POS…" />}
        {terminalsQuery.error && (
          <Notice title="Không tải được danh sách máy POS" tone="error">
            <Button tone="secondary" onClick={terminalsQuery.retry}>
              Thử lại
            </Button>
          </Notice>
        )}
        {terminalsQuery.data && (
          terminalsQuery.data.length > 0 ? (
            <div className={styles.areaTable}>
              <DataTable label="Danh sách máy POS offline" headers={['Mã máy POS', 'Tên thiết bị', 'Khu vực đặt máy', 'Trạng thái']}>
                {terminalsQuery.data.map(t => {
                  const host = areaById.get(t.areaId)
                  return (
                    <tr key={t.terminalId}>
                      <th scope="row">{t.code}</th>
                      <td>{t.name}</td>
                      <td>{host ? `${areaLabel(host)} (Boong ${host.deckNumber})` : 'Đã gắn khu vực'}</td>
                      <td>{t.enabled ? 'Đang bật' : 'Tạm tắt'}</td>
                    </tr>
                  )
                })}
              </DataTable>
            </div>
          ) : (
            <Empty title="Tàu chưa có máy POS offline nào được đăng ký" />
          )
        )}

        {deckId && areasOnDeck.length > 0 ? (
          <form className={styles.stack} noValidate onSubmit={createTerminal}>
            <div className={styles.posFormGrid}>
              <Field htmlFor="pos-terminal-area" label="Khu vực đặt máy *">
                <select
                  id="pos-terminal-area"
                  value={activePosAreaId}
                  disabled={posBusy}
                  required
                  onChange={e => setPosAreaId(e.target.value)}
                >
                  <option value="">Chọn khu vực trên boong</option>
                  {areasOnDeck.map(area => (
                    <option key={area.id} value={area.id}>
                      {areaLabel(area)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field htmlFor="pos-terminal-code" label="Mã máy POS *">
                <input
                  id="pos-terminal-code"
                  value={posCode}
                  maxLength={60}
                  placeholder="VD: POS-DINING-01"
                  disabled={posBusy}
                  required
                  onChange={e => setPosCode(e.target.value)}
                />
              </Field>
              <Field htmlFor="pos-terminal-name" label="Tên máy POS *">
                <input
                  id="pos-terminal-name"
                  value={posName}
                  maxLength={200}
                  placeholder="VD: POS Nhà hàng Grand Horizon"
                  disabled={posBusy}
                  required
                  onChange={e => setPosName(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Button type="submit" busy={posBusy} disabled={!activePosAreaId || !posCode.trim() || !posName.trim()}>
                Đăng ký máy POS offline
              </Button>
            </div>
          </form>
        ) : (
          <p className={styles.configHint}>Chọn một boong có khu vực 3D ở phía trên để đăng ký thêm máy POS offline.</p>
        )}

        {posError && (
          <Notice title="Chưa đăng ký được máy POS" tone="error">
            {posError}
          </Notice>
        )}
        {createdSecret && (
          <Notice title={`Đã đăng ký ${createdSecret.name} (${createdSecret.code})`} tone="success">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span>Mã kích hoạt thiết bị offline (chỉ hiển thị 1 lần): <code>{createdSecret.secret}</code></span>
              <Button
                type="button"
                tone="secondary"
                size="compact"
                autoWidth
                onClick={() => {
                  void navigator.clipboard?.writeText(createdSecret.secret).then(() => setCopiedSecret(true))
                }}
              >
                {copiedSecret ? 'Đã sao chép' : 'Sao chép mã bảo mật'}
              </Button>
            </div>
          </Notice>
        )}
      </section>
    </div>
  )
}
