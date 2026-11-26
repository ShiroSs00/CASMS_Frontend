import { useCallback, useId, useRef, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { journeyTime, validTimeZone, wallTimeToInstant, zonedInput } from '@/shared/lib/journey-time'
import { Badge, Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import styles from './ManagerWorkspace.module.css'

type Plan = {
  stopId: string
  portName: string
  timeZone: string | null
  arrival: string
  scheduledEnd: string
  startsAt: string | null
  durationMinutes: number | null
  endsAt: string | null
  revision: number
  canEdit: boolean
  needsUpdate: boolean
  expectedPassengerCount: number | null
}

export function DisembarkationPlan({ cruiseId }: { cruiseId: string }) {
  const path = `/cruise/${encodeURIComponent(cruiseId)}/disembarkation`
  const query = useReadQuery(
    path,
    useCallback(signal => apiRequest<Plan | null>(path, { signal }), [path]),
  )
  return (
    <Panel
      title="Kế hoạch trả khách ở cảng cuối"
      subtitle=""
    >
      {query.loading && <Loading label="Đang tải khung trả khách…" />}
      {query.error && (
        <Notice title="Chưa tải được khung trả khách" tone="error">
          <Button tone="secondary" onClick={query.retry}>
            Tải lại
          </Button>
        </Notice>
      )}
      {!query.loading && !query.error && !query.data && <p>Cần có cảng kết thúc trong lịch của tour.</p>}
      {query.data && (
        <PlanForm
          key={`${query.data.stopId}:${query.data.arrival}:${query.data.revision}`}
          plan={query.data}
          path={path}
          onSaved={query.retry}
        />
      )}
    </Panel>
  )
}

function PlanForm({ plan, path, onSaved }: { plan: Plan; path: string; onSaved: () => void }) {
  const zone = validTimeZone(plan.timeZone) ? plan.timeZone : null
  const id = useId()
  const arrival = Date.parse(plan.arrival)
  const endLimit = Date.parse(plan.scheduledEnd)
  const arrivalWall = zone && Number.isFinite(arrival) ? zonedInput(plan.arrival, zone).slice(0, 16) : ''
  const endLimitWall = zone && Number.isFinite(endLimit) ? zonedInput(plan.scheduledEnd, zone).slice(0, 16) : ''
  const availableMinutes = Number.isFinite(arrival) && Number.isFinite(endLimit) && endLimit > arrival
    ? Math.floor((endLimit - arrival) / 60_000)
    : 0
  const suggestedMinutes = availableMinutes > 0 ? Math.min(60, availableMinutes) : ''
  const [start, setStart] = useState(plan.startsAt && zone ? zonedInput(plan.startsAt, zone).slice(0, 16) : arrivalWall)
  const [minutes, setMinutes] = useState(plan.durationMinutes?.toString() ?? (suggestedMinutes ? String(suggestedMinutes) : ''))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  let startsAt = ''
  let fieldError = ''
  if (zone && start) {
    try {
      startsAt = wallTimeToInstant(start, zone)
    } catch (cause) {
      fieldError = cause instanceof Error ? cause.message : 'Kiểm tra lại ngày giờ.'
    }
  }
  const duration = Number(minutes)
  const finish = Date.parse(startsAt) + duration * 60_000
  const valid =
    startsAt &&
    Number.isSafeInteger(duration) &&
    duration > 0 &&
    Date.parse(startsAt) >= arrival &&
    finish <= endLimit
  const changed = Date.parse(startsAt) !== Date.parse(plan.startsAt ?? '') || duration !== plan.durationMinutes
  const display = (time: string | null | undefined) => {
    if (!time || !Number.isFinite(Date.parse(time))) return 'Chưa xác định'
    return zone ? journeyTime(time, zone) : `${journeyTime(time, 'UTC')} UTC`
  }

  return (
    <div className={styles.disembarkationBlock}>
      <div className={styles.disembarkationHeader}>
        <div>
          <strong>{plan.portName}</strong>
          <span className={styles.sectionMeta}>
            {plan.expectedPassengerCount ? `${plan.expectedPassengerCount} khách dự kiến` : 'Chưa ghi nhận số khách'}
          </span>
        </div>
        <Badge
          label={
            plan.startsAt && plan.endsAt
              ? 'Đã thiết lập khung trả khách'
              : plan.needsUpdate
                ? 'Cần cập nhật lại'
                : 'Chưa thiết lập'
          }
          tone={plan.startsAt && plan.endsAt ? 'success' : 'warning'}
        />
      </div>

      <div className={styles.disembarkationMetrics3Col}>
        <div className={styles.disembarkationMetricItem}>
          <span>Tàu cập cảng cuối</span>
          <strong>{display(plan.arrival)}</strong>
        </div>
        <div className={styles.disembarkationMetricItem}>
          <span>Mốc kết thúc lịch trình</span>
          <strong>{display(plan.scheduledEnd)}</strong>
        </div>
        <div className={styles.disembarkationMetricItem}>
          <span>Khung trả khách đã lưu</span>
          <strong>
            {plan.startsAt && plan.endsAt
              ? `${display(plan.startsAt)} – ${display(plan.endsAt)}`
              : plan.needsUpdate
                ? 'Lịch cảng đã thay đổi, cần lập lại'
                : 'Chưa thiết lập'}
          </strong>
        </div>
      </div>

      {plan.canEdit && !zone && <p>Cập nhật múi giờ của cảng trước khi lập khung trả khách.</p>}
      {plan.canEdit && zone && (
        <form
          noValidate
          onSubmit={async event => {
            event.preventDefault()
            if (!valid || !changed || lock.current) return
            lock.current = true
            setBusy(true)
            setError('')
            try {
              await apiRequest(path, {
                method: 'PUT',
                body: {
                  stopId: plan.stopId,
                  expectedArrival: plan.arrival,
                  expectedRevision: plan.revision,
                  startsAt,
                  durationMinutes: duration,
                },
              })
              onSaved()
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Chưa lưu được khung trả khách.')
            } finally {
              lock.current = false
              setBusy(false)
            }
          }}
        >
          <div className={styles.fieldGrid}>
            <Field htmlFor={id + '-start'} label="Bắt đầu trả khách *" hint="Mặc định lấy theo giờ tàu cập cảng (giờ địa phương cảng)." error={fieldError}>
              <input
                id={id + '-start'}
                type="datetime-local"
                step={60}
                min={arrivalWall || undefined}
                max={endLimitWall || undefined}
                value={start}
                required
                disabled={busy}
                onChange={event => setStart(event.target.value)}
              />
            </Field>
            <Field htmlFor={id + '-minutes'} label="Thời lượng dự kiến (phút) *" hint={availableMinutes > 0 ? `Tối đa ${availableMinutes} phút trong khung lịch cảng.` : undefined}>
              <input
                id={id + '-minutes'}
                type="number"
                min="1"
                max={availableMinutes > 0 ? availableMinutes : undefined}
                step="1"
                value={minutes}
                required
                disabled={busy}
                onChange={event => setMinutes(event.target.value)}
              />
            </Field>
          </div>
          {valid ? (
            <p className={styles.sectionMeta} aria-live="polite">
              Dự kiến hoàn tất lúc <strong>{display(new Date(finish).toISOString())}</strong>.
            </p>
          ) : (
            startsAt &&
            minutes && <p className={styles.sectionMeta}>Chọn khung trả khách nằm trong thời gian từ lúc cập cảng đến khi kết thúc lịch.</p>
          )}
          <div className={styles.sectionActions}>
            <Button type="submit" autoWidth busy={busy} disabled={!valid || !changed}>
              Lưu khung trả khách
            </Button>
          </div>
          {error && (
            <Notice title="Chưa lưu được khung trả khách" tone="error">
              {error}
            </Notice>
          )}
        </form>
      )}
    </div>
  )
}
