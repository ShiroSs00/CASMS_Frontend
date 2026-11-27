import { useState } from 'react'
import { useBookingModelRenderer } from './BookingModelIntegration'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import type { CruisePackageCatalog, CabinSelectionMode } from '@/domain/cruise-package'
import type { AvailableCabin, BookingPersonDraft } from '../api/real-booking-api'
import { useLiveBooking } from '../model/live-booking-context'
import { groupPassengers, personGroup } from '../model/booking-party'
import { eligibleCabins } from '../model/booking-cabin-selection'
import { cabinTypeName } from '../model/booking-presentation'
import { BookingCabinChoices } from './BookingCabinChoices'
import type { BookingModelRenderer } from './BookingShipModel'
import type { BookingPackageOption } from './LiveBookingFields'
import { CustomerPackageDetails } from './CustomerPackageDetails'
import styles from './BookingParty.module.css'

const unitLabels: Record<string, string> = {
  SESSION: 'buổi',
  HOUR: 'giờ',
  DAY: 'ngày',
  NIGHT: 'đêm',
  PER_PERSON: 'khách',
  PERSON: 'khách',
  ITEM: 'món',
  UNIT: 'đơn vị',
  USE: 'lượt',
  TRIP: 'chuyến',
  MEAL: 'bữa',
  GLASS: 'ly',
  BOTTLE: 'chai',
  GB: 'GB',
}

function formatUnit(code?: string | null) {
  const normalized = (code ?? '').trim().toUpperCase()
  return normalized ? (unitLabels[normalized] ?? 'lượt') : 'lượt'
}

/** Presentation only: a cabin choice is not a reservation. Both views share eligibility. */
export function CruisePackageCabinSelection({ catalog, cabins, shipId, render, packages }: {
  catalog: CruisePackageCatalog; cabins: AvailableCabin[]; shipId?: string | null; render?: BookingModelRenderer; packages?: BookingPackageOption[] | null
}) {
  const { draft, setDraft, errors, setErrors, personIds } = useLiveBooking()
  const renderer = useBookingModelRenderer(), renderModel = render ?? renderer
  const [modelPerson, setModelPerson] = useState<number | null>(null)
  const [applyFrom, setApplyFrom] = useState<number | null>(null), [targets, setTargets] = useState<number[]>([])
  const groups = groupPassengers(draft.passengers)
  function update(index: number, change: Partial<BookingPersonDraft>) {
    setDraft(d => ({ ...d, passengers: d.passengers.map((p, i) => i === index ? { ...p, ...change } : p) }))
    setErrors({})
  }
  function updateGroupMode(groupKey: string, modeValue: CabinSelectionMode) {
    setDraft(d => ({
      ...d,
      passengers: d.passengers.map(p => personGroup(p) === groupKey ? { ...p, cabinSelectionMode: modeValue, cabinId: '' } : p),
    }))
    setErrors({})
  }
  function choices(index: number) { return eligibleCabins(cabins, draft.passengers, index, catalog) }
  function select(index: number, cabinId: string) {
    if (!choices(index).some(c => c.cabinId === cabinId)) return
    const key = personGroup(draft.passengers[index])
    setDraft(d => ({ ...d, passengers: d.passengers.map(p => personGroup(p) === key ? { ...p, cabinId } : p) }))
    setErrors({})
  }
  return <div className={styles.section}>
    {catalog.fareManaged && !catalog.offers.length && <Notice title="Chưa có gói du thuyền khả dụng" tone="warning">Vui lòng chọn hành trình khác hoặc kiểm tra lại sau.</Notice>}
    {groups.map(group => <Panel key={group.key} title={`${group.label} · ${group.members.length} khách`}>
      <div className={styles.section}>
      {group.members.map(index => {
        const p = draft.passengers[index], fare = catalog.offers.find(o => o.selection.offerId === p.farePackageOfferId)?.selection
        return <section key={personIds[index] ?? index} className={styles.passengerConfigCard} aria-label={`Lựa chọn hành khách ${index + 1}`}>
          <div className={styles.passengerConfigHead}>
            <h3>{p.fullName || `Hành khách ${index + 1}`}</h3>
            {index === 0 && <span className={styles.leadTag}>Người đại diện</span>}
          </div>
          {catalog.fareManaged ? <>
            <div>
              <p className={styles.choiceGroupLabel}>Chọn gói du thuyền &amp; hạng cabin *</p>
              {catalog.offers.length > 0 && <div id={`person-${index}-farePackageOfferId`} tabIndex={-1} className={styles.offerPickGrid} role="group" aria-label={`Chọn gói du thuyền cho hành khách ${index + 1}`} aria-invalid={Boolean(errors[`person-${index}-farePackageOfferId`])}>
                {catalog.offers.map(o => {
                  const selected = p.farePackageOfferId === o.selection.offerId
                  const cabinLabel = cabinTypeName(o.selection.cabinType)
                  return <button
                    key={o.selection.offerId}
                    type="button"
                    className={`${styles.offerPickCard} ${selected ? styles.offerPickCardSelected : ''}`}
                    aria-pressed={selected}
                    onClick={() => update(index, {
                      farePackageOfferId: o.selection.offerId,
                      farePackagePriceRevisionId: o.selection.priceRevisionId,
                      tourPackageId: '',
                      cabinId: '',
                    })}
                  >
                    <span className={styles.offerPickMeta}>{cabinLabel}</span>
                    <strong>{o.selection.templateName}</strong>
                    <span className={styles.offerPickPrice}>
                      {`${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: o.currencyCode === 'VND' ? 0 : 2 }).format(Number(o.selection.amount))} ${o.currencyCode}`} / người
                    </span>
                  </button>
                })}
              </div>}
              {p.farePackageOfferId && !fare && <Notice title="Gói đã chọn cần kiểm tra lại" tone="warning">Vui lòng chọn một gói du thuyền khả dụng phía trên.</Notice>}
              {errors[`person-${index}-farePackageOfferId`] && <p className={styles.inlineError} role="alert">{errors[`person-${index}-farePackageOfferId`]}</p>}
            </div>
            {fare && <details className={styles.benefitDrawer}><summary>Quyền lợi bao gồm trong gói ({fare.benefits.length})</summary><ul>{fare.benefits.map(b => <li key={b.sourceBenefitId}>{b.resourceName} · {b.inclusion === 'INCLUDED' ? 'Đã bao gồm' : b.inclusion === 'LIMITED_INCLUDED' ? `Đã bao gồm, giới hạn ${b.quantityLimit} ${formatUnit(b.serviceUnitCode)}` : b.inclusion === 'OPTIONAL' ? 'Tùy chọn' : 'Không bao gồm'}{b.requiresReservation && ' · Cần đăng ký riêng'}</li>)}</ul></details>}
            <div>
              <p className={styles.choiceGroupLabel}>Cách nhận cabin *</p>
              {group.members.length > 1 && <p className={styles.muted}>Áp dụng đồng nhất cho tất cả hành khách cùng ở {group.label.toLowerCase()}.</p>}
              <div id={`person-${index}-cabinSelectionMode`} tabIndex={-1} className={styles.choiceCardGrid} role="group" aria-label={`Cách nhận cabin cho hành khách ${index + 1}`} aria-invalid={Boolean(errors[`person-${index}-cabinSelectionMode`])}>
                {([
                  ['PHYSICAL_CABIN', 'Chọn cabin cụ thể', 'Tự chọn số phòng trên danh sách cabin trống hoặc sơ đồ tàu 3D.'],
                  ['CATEGORY_HOLD', 'Giữ chỗ theo hạng, chọn phòng sau', 'Hệ thống giữ suất theo hạng cabin đã chọn; số phòng cụ thể sẽ được phân bổ sau.'],
                ] as const).map(([modeValue, modeTitle, modeDesc]) => {
                  const active = p.cabinSelectionMode === modeValue
                  return <button
                    key={modeValue}
                    type="button"
                    className={`${styles.choiceCard} ${active ? styles.choiceCardActive : ''}`}
                    aria-pressed={active}
                    onClick={() => updateGroupMode(group.key, modeValue as CabinSelectionMode)}
                  >
                    <div className={styles.choiceCardHead}>
                      <span className={styles.choiceCardTitle}>{modeTitle}</span>
                      <span className={styles.choiceCardCheck} aria-hidden="true">✓</span>
                    </div>
                    <span className={styles.choiceCardDesc}>{modeDesc}</span>
                  </button>
                })}
              </div>
              {errors[`person-${index}-cabinSelectionMode`] && <p className={styles.inlineError} role="alert">{errors[`person-${index}-cabinSelectionMode`]}</p>}
            </div>
            {fare && p.cabinSelectionMode && group.members.length > 1 && <Button tone="text" onClick={() => { setApplyFrom(index); setTargets([]) }}>Áp dụng gói &amp; cách chọn phòng này cho khách khác trong phòng</Button>}
          </> : <>
            <Field htmlFor={`person-${index}-tourPackageId`} label="Gói dịch vụ (tùy chọn)" error={errors[`person-${index}-tourPackageId`]}>
              <select id={`person-${index}-tourPackageId`} value={p.tourPackageId} disabled={!packages && !p.tourPackageId} onChange={e => update(index, { tourPackageId: e.target.value })}>
                <option value="">Không chọn gói</option>{packages?.map(pack => <option key={pack.id} value={pack.id} disabled={pack.currency !== draft.currency}>{pack.name} · {pack.price} {pack.currency}</option>)}
              </select>
            </Field>
            {p.tourPackageId && <CustomerPackageDetails id={p.tourPackageId} passenger={index + 1} />}
          </>}
          {errors[`person-${index}-cabinGroupKey`] && <p id={`person-${index}-cabinGroupKey`} tabIndex={-1} role="alert">{errors[`person-${index}-cabinGroupKey`]}</p>}
        </section>
      })}
      {(!catalog.fareManaged || draft.passengers[group.members[0]].cabinSelectionMode === 'PHYSICAL_CABIN') && <>
        <BookingCabinChoices name={`person-${group.members[0]}-cabinId`} cabins={choices(group.members[0])} selectedCabinId={draft.passengers[group.members[0]].cabinId} onSelect={id => select(group.members[0], id)} error={group.members.map(i => errors[`person-${i}-cabinId`]).find(Boolean)} />
        {renderModel && shipId && <div><Button tone="secondary" onClick={() => setModelPerson(group.members[0])}>Mở 3D · {group.label}</Button></div>}
      </>}
      </div>
    </Panel>)}
    {modelPerson !== null && renderModel && shipId && <Modal title="Xem và chọn cabin trên tàu" large protectChanges={false} onClose={() => setModelPerson(null)} footer={<Button data-overlay-dismiss onClick={() => setModelPerson(null)}>Xong</Button>}>
      <p>Lựa chọn được cập nhật đồng thời trong danh sách cabin.</p>
      {renderModel({ shipId, cruiseId: draft.cruiseId, cabins: choices(modelPerson).map(c => ({ cabinId: c.cabinId, remainingCapacity: c.remainingCapacity })), selectedCabinId: draft.passengers[modelPerson]?.cabinId || undefined, onSelectCabin: id => select(modelPerson, id) })}
    </Modal>}
    {applyFrom !== null && <Modal title="Áp dụng gói và cách chọn cabin" onClose={() => setApplyFrom(null)} footer={<><Button tone="secondary" data-overlay-dismiss onClick={() => setApplyFrom(null)}>Hủy</Button><Button disabled={!targets.length} onClick={() => {
      const source = draft.passengers[applyFrom]
      setDraft(d => ({ ...d, passengers: d.passengers.map((p, i) => targets.includes(i) ? { ...p, farePackageOfferId: source.farePackageOfferId, farePackagePriceRevisionId: source.farePackagePriceRevisionId, cabinSelectionMode: source.cabinSelectionMode, cabinId: '', tourPackageId: '' } : p) }))
      setErrors({}); setApplyFrom(null)
    }}>Áp dụng cho {targets.length} người</Button></>}>
      <div className={styles.section}>{groups.find(g => g.members.includes(applyFrom))?.members.filter(i => i !== applyFrom).map(i => <label className={styles.row} key={personIds[i]}><span>{draft.passengers[i].fullName || `Hành khách ${i + 1}`}</span><input type="checkbox" checked={targets.includes(i)} onChange={e => setTargets(ids => e.target.checked ? [...ids, i] : ids.filter(id => id !== i))} /></label>)}</div>
    </Modal>}
  </div>
}
