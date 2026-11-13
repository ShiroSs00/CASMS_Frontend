import { useCallback, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { planEvidence, frozenResource, evidenceText, evidenceNumber, evidenceRow, chargeText } from '../model/plan-evidence'
import { journeyTime } from '@/shared/lib/journey-time'
import styles from './PlanSnapshot.module.css'
import { Badge, Button, Loading, Notice, Panel } from '@/shared/ui'
import { planPackages, type Choice } from '../api/plan-packages'
import { saleTermsApi } from '../api/sale-terms'

export function PlanPackageSelection({ cruiseId, onSaved }: { cruiseId: string; onSaved: () => void }) {
  const access = useSessionAccess()
  const editable = access.roles.includes('CRUISE_MANAGER') && access.canDo('CRUISE_UPDATE_DRAFT')
  const query = useReadQuery('plan-package-selection:' + access.userId + ':' + access.status + ':' + cruiseId, useCallback(signal => planPackages(cruiseId, signal), [cruiseId]))
  const terms = useReadQuery('plan-package-terms:' + access.userId + ':' + cruiseId, useCallback(signal => saleTermsApi.read(cruiseId, signal), [cruiseId]))
  const [draft, setDraft] = useState<Choice[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const data = query.data
  const selected = draft ?? data?.selections ?? []

  async function save() {
    if (!editable || !data || !draft || lock.current || query.loading || query.error) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await planPackages(cruiseId, undefined, { expectedSelectionRevision: data.selectionRevision, selections: draft })
      setDraft(null)
      query.retry()
      onSaved()
    } catch {
      setError('Chưa xác nhận được lựa chọn. Tải lại danh sách trước khi gửi lại.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <Panel title="Gói du thuyền trình duyệt">
    {query.loading && <Loading/>}
    {(query.error || error) && <Notice tone="error" title="Cần đối chiếu lựa chọn"><p>{error || 'Không tải được gói du thuyền.'}</p><Button tone="secondary" onClick={() => { setDraft(null); setError(''); query.retry() }}>Tải lại gói</Button></Notice>}
    {!query.loading && !query.error && data?.offers.length === 0 && <p>Chuyến chưa có gói du thuyền. Đang chờ Quản lý hoạt động và dịch vụ cấu hình gói và gửi phiên bản giá.</p>}
    {data?.offers.map(({ product, eligiblePriceRevisionId, planEligibility }) => {
      const id = product.offer.id
      const choice = selected.find(item => item.offerId === id)
      const price = product.prices.find(item => item.id === (choice?.priceRevisionId ?? eligiblePriceRevisionId))
      const canSelect = Boolean(eligiblePriceRevisionId && planEligibility.eligible)
      const staleSelection = choice && choice.priceRevisionId !== eligiblePriceRevisionId
      const blockers = [...new Set(planEligibility.blockers.map(blocker => blocker.message))]
      const benefits = product.template.benefits
      const priceLabel = price ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(Number(price.amount))} USD/người` : 'Chưa có giá'
      return <article key={id} className={styles.selectionItem}>
        <div className={styles.selectionHeader}>
          <label className={styles.selectionChoice}>
            <input type="checkbox" checked={Boolean(choice)} disabled={!editable || busy || query.loading || Boolean(query.error) || Boolean(error) || !choice && !canSelect}
              onChange={event => setDraft(event.target.checked && eligiblePriceRevisionId
                ? [...selected, { offerId: id, priceRevisionId: eligiblePriceRevisionId }]
                : selected.filter(item => item.offerId !== id))}/>
            <span><strong>{product.template.version.name}</strong><small>{product.offer.logicalCategory}</small></span>
          </label>
          <div className={styles.selectionPrice}>
            <strong>{priceLabel}</strong>
            {price&&<small>Phiên bản giá {price.revisionNumber}</small>}
          </div>
          {(!canSelect||staleSelection)&&<Badge label={staleSelection?'Cần chọn lại giá':'Chưa thể chọn'} tone="warning"/>}
        </div>
        {blockers.length>0&&<details className={styles.selectionDetails}>
          <summary>Việc cần xử lý</summary>
          <ul>{blockers.map(message=><li key={message}>{message}</li>)}</ul>
        </details>}
        {benefits.length>0&&<details className={styles.selectionDetails}>
          <summary>Quyền lợi trong gói</summary>
          <ul>{benefits.map(benefit=><li key={benefit.id}>
            {product.template.resourceNames[benefit.id] ?? 'Quyền lợi'} · {inclusionLabels[benefit.inclusion] ?? 'Chưa xác định'}
          </li>)}</ul>
        </details>}
      </article>
    })}
    {selected.filter(choice => !data?.offers.some(candidate => candidate.product.offer.id === choice.offerId)).map(choice =>
      <p key={choice.offerId}>Gói đã chọn không còn khả dụng. <Button tone="secondary" disabled={busy} onClick={() => setDraft(selected.filter(item => item.offerId !== choice.offerId))}>Bỏ gói khỏi hồ sơ</Button></p>)}
    {terms.data?.terms && <p>Thuế: {chargeText(terms.data.terms.tax, true)} · Phí cảng: {chargeText(terms.data.terms.portFee, false)}</p>}
    {terms.error && <Button tone="secondary" onClick={terms.retry}>Tải lại thuế và phí cảng</Button>}
    <div className={styles.selectionActions}><Button autoWidth disabled={!editable || !draft || busy || Boolean(error) || query.loading || Boolean(query.error)} onClick={() => void save()}>Lưu lựa chọn gói</Button></div>
  </Panel>
}

const inclusionLabels: Record<string, string> = { INCLUDED: 'Đã bao gồm', LIMITED_INCLUDED: 'Đã bao gồm · Có giới hạn', OPTIONAL: 'Mua thêm nếu lựa chọn', NOT_INCLUDED: 'Không bao gồm' }
const show = (value: unknown) => evidenceText(value) ?? 'Chưa có thông tin trong bản đã gửi'
export function FrozenPlanPackages({ snapshot }: { snapshot: unknown }) {
  const frozen = planEvidence(snapshot)
  if (!frozen.hasPackages) return <Notice title="Chưa có bằng chứng gói trong hồ sơ">Cần đọc lại bản đã gửi trước khi xét duyệt.</Notice>
  return <section className={styles.commercial} aria-label="Gói và giá trong hồ sơ đã gửi">
    <h3>Gói du thuyền trong hồ sơ</h3>
    {!frozen.packages.length && <p>Hồ sơ chưa chọn gói du thuyền.</p>}
    {frozen.packages.map((item, index) => <section className={styles.package} key={item.offerId ?? index}>
      <h4>{item.name ?? 'Chưa có tên gói trong hồ sơ'}</h4>
      <p>{item.category ?? 'Chưa có hạng cabin'} · Mẫu phiên bản {item.version ?? 'chưa xác định'}</p>
      <p className={styles.packagePrice}>{item.amount !== null && item.currency === 'USD' && item.priceUnit === 'PERSON' ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(item.amount)} USD/người` : 'Chưa xác nhận được giá'} · Giá phiên bản {item.priceRevision ?? 'chưa xác định'}</p>
      {!item.valid && <Notice title="Bằng chứng giá chưa đầy đủ" tone="error">Đọc lại hồ sơ để đối chiếu đúng gói và phiên bản giá trước khi quyết định.</Notice>}
      <details className={styles.group}><summary>Quyền lợi và lần phục vụ <span>{item.benefits.length} quyền lợi</span></summary><div className={styles.groupBody}>
        {item.benefits.length === 0 && <p>Chưa có chi tiết quyền lợi trong bản đã gửi.</p>}
        {item.benefits.map((benefit, bIndex) => {
          const binding = item.bindings.find(b => b.benefit_id === benefit.benefit_id)
          const resource = frozenResource(snapshot, binding ?? benefit)
          const quantity = evidenceNumber(benefit.quantity_limit)
          return <section key={evidenceText(benefit.benefit_id) ?? bIndex}>
            <strong>{resource.name ?? resource.kind}</strong>
            {!resource.name && <p>Chưa có tên trong bản đã gửi. Mã tham chiếu: {resource.id ?? 'Chưa có'}</p>}
            <p>{inclusionLabels[String(benefit.inclusion)] ?? 'Chưa xác định loại quyền lợi'}</p>
            {benefit.inclusion === 'LIMITED_INCLUDED' && <p>Giới hạn: {quantity ?? 'Chưa có số lượng'} · {benefit.usage_unit==='PARTICIPATION'?'Lần tham gia':show(benefit.service_unit_code ?? benefit.usage_unit)}</p>}
            {benefit.usage_policy === 'UNLIMITED' && <p>Sử dụng không giới hạn theo chính sách của bản đã gửi.</p>}
            {typeof benefit.requires_reservation === 'boolean' && <p>{benefit.requires_reservation ? 'Cần đăng ký trước; quyền lợi chưa giữ suất phục vụ.' : 'Không yêu cầu đăng ký theo cấu hình quyền lợi.'}</p>}
            {evidenceText(benefit.eligibility) && <p>{String(benefit.eligibility)}</p>}
            {benefit.usage_starts_at != null && <p>Được sử dụng từ: {journeyTime(String(benefit.usage_starts_at))}</p>}
            {benefit.usage_ends_at != null && <p>Được sử dụng đến: {journeyTime(String(benefit.usage_ends_at))}</p>}
            <p>{binding ? 'Đã gắn lần phục vụ trong hồ sơ' : 'Chưa có liên kết lần phục vụ trong hồ sơ'}</p>
            {resource.row.start_time != null && <p>Bắt đầu (giờ Việt Nam): {journeyTime(String(resource.row.start_time))}</p>}
            {resource.row.end_time != null && <p>Kết thúc (giờ Việt Nam): {journeyTime(String(resource.row.end_time))}</p>}
            {resource.row.service_id != null && <ul>{(Array.isArray(frozen.source.servingWindows) ? frozen.source.servingWindows : []).map(evidenceRow).filter(w => w.service_id === resource.id).map((w, i) => <li key={i}>{journeyTime(String(w.starts_at))} – {journeyTime(String(w.ends_at))}{w.location ? ` · ${String(w.location)}` : ''}</li>)}</ul>}
          </section>
        })}
      </div></details>

    </section>)}
    <section className={styles.terms}><h3>Thuế và phí cảng trong hồ sơ</h3>{(['tax', 'portFee'] as const).map(key => {
      const charge = evidenceRow(frozen.terms[key])
      return <div key={key}><strong>{key === 'tax' ? 'Thuế' : 'Phí cảng'}: {chargeText(charge, key === 'tax')}</strong>
        {evidenceText(charge.reason) && <p>Lý do: {String(charge.reason)}</p>}{evidenceText(charge.evidence) && <p>Căn cứ: {String(charge.evidence)}</p>}
      </div>
    })}</section>
  </section>
}
