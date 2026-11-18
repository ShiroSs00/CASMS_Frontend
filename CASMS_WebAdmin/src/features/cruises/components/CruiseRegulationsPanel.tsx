import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge, Button, ButtonLink, Loading, Notice, Panel } from '@/shared/ui'
import { SHIP_TIME_ZONE, journeyTime, validTimeZone } from '@/shared/lib/journey-time'
import {
  formatRegulationValue,
  groupRegulationsBySource,
  regulationStatusLabels,
  regulationTypeLabels,
} from '@/shared/i18n/regulation-labels'
import { cruiseApi } from '../api/cruise-api'
import type { CruiseDetailView, RegulationSummary } from '../model/cruise-view'
import styles from './Cruises.module.css'

export type RegulationReferenceMode = 'departure' | 'now'

type SnapshotOverride = {
  key: string
  checkedAt: string | null
  regulations: RegulationSummary[]
}

function statusTone(status: RegulationSummary['status']) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'DRAFT') return 'info' as const
  if (status === 'EXPIRED') return 'warning' as const
  return 'neutral' as const
}

function formatEffectiveWindow(item: RegulationSummary, zone: string): string | null {
  if (!item.effectiveFrom && !item.effectiveTo) return null
  const start = item.effectiveFrom ? journeyTime(item.effectiveFrom, zone) : 'Không ấn định'
  const end = item.effectiveTo ? journeyTime(item.effectiveTo, zone) : 'Không giới hạn'
  return `${start} → ${end}`
}

export type CruiseRegulationsPanelProps = {
  detail: CruiseDetailView
  loading?: boolean
  error?: string
  checkEpoch?: number
  canAssign?: boolean
  canReadDetail?: boolean
  canReadShip?: boolean
  canReadShipRegulations?: boolean
  onReloadDetail?: () => void
  renderAssignment?: (cruiseId: string, onAssigned: () => void) => ReactNode
}

export function CruiseRegulationsPanel({
  detail,
  loading = false,
  error,
  checkEpoch = 0,
  canAssign = false,
  canReadDetail = false,
  canReadShip = false,
  canReadShipRegulations = false,
  onReloadDetail,
  renderAssignment,
}: CruiseRegulationsPanelProps) {
  const { cruise, ship, departurePort } = detail
  const [referenceMode, setReferenceMode] = useState<RegulationReferenceMode>('departure')
  const [nowRetryTick, setNowRetryTick] = useState(0)
  const [modeLoading, setModeLoading] = useState(false)
  const [modeError, setModeError] = useState<string | null>(null)
  const [snapshotOverride, setSnapshotOverride] = useState<SnapshotOverride | null>(null)

  const displayZone = validTimeZone(departurePort?.timeZoneId) ? departurePort.timeZoneId : SHIP_TIME_ZONE
  const zoneLabel = displayZone === SHIP_TIME_ZONE ? 'Giờ Việt Nam' : `Giờ cảng đi (${displayZone})`
  const scopeKey = `${cruise.cruiseId}:${cruise.shipId ?? 'none'}:${cruise.departureDatetime}:${checkEpoch}:${referenceMode}`

  useEffect(() => {
    if (referenceMode !== 'now') return
    const controller = new AbortController()
    let active = true

    const fetchNowSnapshot = async () => {
      setModeLoading(true)
      setModeError(null)
      try {
        const result = await cruiseApi.effectiveRegulations(cruise.cruiseId, undefined, controller.signal)
        if (active && !controller.signal.aborted) {
          setSnapshotOverride({
            key: `${cruise.cruiseId}:${cruise.shipId ?? 'none'}:${cruise.departureDatetime}:${checkEpoch}:now`,
            checkedAt: result.checkedAt,
            regulations: result.regulations,
          })
        }
      } catch (err) {
        if (active && !controller.signal.aborted) {
          setModeError(err instanceof Error ? err.message : 'Không tải được quy định hiệu lực theo mốc hiện tại.')
        }
      } finally {
        if (active && !controller.signal.aborted) {
          setModeLoading(false)
        }
      }
    }

    void fetchNowSnapshot()
    return () => {
      active = false
      controller.abort()
    }
  }, [checkEpoch, cruise.cruiseId, cruise.departureDatetime, cruise.shipId, nowRetryTick, referenceMode])

  const activeOverride = snapshotOverride?.key === scopeKey ? snapshotOverride : null
  const activeRegulations = useMemo(
    () =>
      referenceMode === 'now'
        ? (activeOverride?.regulations ?? [])
        : (activeOverride?.regulations ?? detail.regulations),
    [activeOverride, detail.regulations, referenceMode],
  )
  const activeCheckedAt =
    referenceMode === 'now'
      ? (activeOverride?.checkedAt ?? null)
      : (activeOverride?.checkedAt ?? detail.regulationCheckedAt ?? cruise.departureDatetime)

  const isBusy = loading || (referenceMode === 'now' && modeLoading)
  const activeError = referenceMode === 'now' ? modeError : error
  const groups = useMemo(() => groupRegulationsBySource(activeRegulations), [activeRegulations])

  const handleModeSwitch = (nextMode: RegulationReferenceMode) => {
    if (nextMode === referenceMode) return
    setModeError(null)
    setReferenceMode(nextMode)
  }

  const handleRetry = () => {
    if (referenceMode === 'now') {
      setNowRetryTick((value) => value + 1)
      return
    }
    onReloadDetail?.()
  }

  const handleAssigned = useCallback(() => {
    if (referenceMode === 'now') {
      setNowRetryTick((value) => value + 1)
    }
    onReloadDetail?.()
  }, [onReloadDetail, referenceMode])

  const countSuffix = !isBusy && !activeError ? ` · ${activeRegulations.length} đang hiệu lực` : ''
  const checkedAtText = activeCheckedAt ? journeyTime(activeCheckedAt, displayZone) : 'Chưa xác định'

  return (
    <Panel
      title={`Quy định vận hành${countSuffix}`}
      subtitle="Kiểm tra đầy đủ quy định chung, quy định kế thừa từ tàu và quy định riêng cho chuyến theo mốc thời gian."
    >
      <p className={styles.muted}>
        Danh sách này hỗ trợ kiểm tra điều kiện an toàn trước chuyến đi; không thay thế giấy phép cảng hay kiểm tra thuyền viên.
      </p>

      <div className={styles.regReferenceBar}>
        <div className={styles.regReferenceMeta}>
          <span className={styles.regReferenceLabel}>
            {referenceMode === 'now' ? 'Mốc đối chiếu hiện tại' : 'Mốc đối chiếu tại giờ khởi hành đã lưu'}
          </span>
          <strong className={styles.regReferenceTime}>
            {checkedAtText} ({zoneLabel})
          </strong>
          {referenceMode === 'now' && (
            <Badge label="Đang xem hiệu lực hiện tại" tone="info" />
          )}
        </div>
        <div className={styles.regModeGroup} role="group" aria-label="Chọn mốc đối chiếu quy định">
          <button
            type="button"
            className={referenceMode === 'departure' ? styles.regModeButtonActive : styles.regModeButton}
            aria-pressed={referenceMode === 'departure'}
            disabled={isBusy}
            onClick={() => handleModeSwitch('departure')}
          >
            Giờ khởi hành
          </button>
          <button
            type="button"
            className={referenceMode === 'now' ? styles.regModeButtonActive : styles.regModeButton}
            aria-pressed={referenceMode === 'now'}
            disabled={isBusy}
            onClick={() => handleModeSwitch('now')}
          >
            Hiện tại
          </button>
        </div>
      </div>

      {isBusy ? (
        <Loading label="Đang tải quy định hiệu lực theo mốc đối chiếu…" />
      ) : activeError ? (
        <Notice title="Không tải được quy định vận hành" tone="error" role="alert">
          <p>{activeError}</p>
          <Button size="compact" tone="secondary" onClick={handleRetry}>
            Tải lại quy định
          </Button>
        </Notice>
      ) : (
        <div className={styles.regGroups}>
          {groups.map((group) => {
            const isCruiseGroup = group.key === 'CRUISE'
            const isShipGroup = group.key === 'SHIP'

            let emptyMessage = 'Chưa có quy định nào đang hiệu lực tại mốc đối chiếu này.'
            if (isShipGroup && !cruise.shipId) {
              emptyMessage = 'Chuyến chưa được phân công tàu nên chưa có quy định kế thừa từ tàu.'
            } else if (isShipGroup && ship) {
              emptyMessage = `Tàu ${ship.shipName} chưa có quy định nào đang hiệu lực tại mốc đối chiếu này.`
            } else if (isCruiseGroup) {
              emptyMessage = 'Chưa có quy định riêng nào đang hiệu lực cho chuyến này tại mốc đối chiếu.'
            }

            return (
              <section key={group.key} className={styles.regGroup} aria-label={group.title}>
                <header className={styles.regGroupHeader}>
                  <div className={styles.regGroupTitleWrap}>
                    <h3>
                      {group.title} · {group.items.length}
                    </h3>
                    <span className={styles.regGroupRole}>
                      {isShipGroup && ship ? `${ship.shipName} (${ship.shipCode}) · Chỉ đọc` : group.roleLabel}
                    </span>
                  </div>
                  <div className={styles.regGroupActions}>
                    {isShipGroup && cruise.shipId && canReadShipRegulations ? (
                      <ButtonLink
                        tone="secondary"
                        size="compact"
                        to={`/admin/ships/${encodeURIComponent(cruise.shipId)}/regulations`}
                      >
                        Xem quy định tàu
                      </ButtonLink>
                    ) : isShipGroup && cruise.shipId && canReadShip ? (
                      <ButtonLink
                        tone="secondary"
                        size="compact"
                        to={`/admin/ships/${encodeURIComponent(cruise.shipId)}`}
                      >
                        Hồ sơ tàu
                      </ButtonLink>
                    ) : null}
                    {isCruiseGroup && canAssign && renderAssignment?.(cruise.cruiseId, handleAssigned)}
                    {isCruiseGroup && canReadDetail && (
                      <ButtonLink
                        tone="secondary"
                        size="compact"
                        to={`/admin/cruises/${encodeURIComponent(cruise.cruiseId)}/regulations`}
                      >
                        Quản lý & gỡ quy định
                      </ButtonLink>
                    )}
                  </div>
                </header>

                {group.items.length > 0 ? (
                  <ul className={styles.regItemList}>
                    {group.items.map((item) => {
                      const typeText = item.regulationType
                        ? regulationTypeLabels[item.regulationType]
                        : null
                      const valueText = formatRegulationValue(item.value, item.unit)
                      const windowText = formatEffectiveWindow(item, displayZone)
                      const statusText = regulationStatusLabels[item.status] ?? item.status

                      return (
                        <li key={item.regulationId} className={styles.regItemRow}>
                          <div className={styles.regItemMain}>
                            <strong className={styles.regItemHeading}>
                              {item.code} · {item.name}
                            </strong>
                            {item.description && (
                              <p className={styles.regItemDescription}>{item.description}</p>
                            )}
                          </div>
                          {(typeText || valueText || windowText) && (
                            <div className={styles.regItemFacts}>
                              {(typeText || valueText) && (
                                <span className={styles.regItemRule}>
                                  {[typeText, valueText].filter(Boolean).join(': ')}
                                </span>
                              )}
                              {windowText && (
                                <span className={styles.regItemWindow}>
                                  Hiệu lực: {windowText}
                                </span>
                              )}
                            </div>
                          )}
                          <div className={styles.regItemStatus}>
                            <Badge label={statusText} tone={statusTone(item.status)} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className={styles.regGroupEmpty}>{emptyMessage}</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
