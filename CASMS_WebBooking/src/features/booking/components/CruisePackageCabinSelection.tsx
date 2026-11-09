import { useState } from 'react'
import { useBookingModelRenderer } from './BookingModelIntegration'
import { Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import type { CruisePackageCatalog, CabinSelectionMode } from '@/domain/cruise-package'
import type { AvailableCabin, BookingPersonDraft } from '../api/real-booking-api'
import { useLiveBooking } from '../model/live-booking-context'
import { groupPassengers, personGroup } from '../model/booking-party'
import { eligibleCabins } from '../model/booking-cabin-selection'
import { BookingCabinChoices } from './BookingCabinChoices'
import type { BookingModelRenderer } from './BookingShipModel'
import type { BookingPackageOption } from './LiveBookingFields'
import { CustomerPackageDetails } from './CustomerPackageDetails'
import styles from './BookingParty.module.css'

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
        return <section key={personIds[index] ?? index} className={styles.section} aria-label={`Lựa chọn hành khách ${index + 1}`}>
          <h3>{p.fullName || `Hành khách ${index + 1}`}</h3>
          {catalog.fareManaged ? <>
            <Field htmlFor={`person-${index}-farePackageOfferId`} label="Gói du thuyền và hạng cabin *" error={errors[`person-${index}-farePackageOfferId`]}>
              <select id={`person-${index}-farePackageOfferId`} value={p.farePackageOfferId ?? ''} onChange={e => {
                const selected = catalog.offers.find(o => o.selection.offerId === e.target.value)?.selection
                update(index, { farePackageOfferId: selected?.offerId, farePackagePriceRevisionId: selected?.priceRevisionId, tourPackageId: '', cabinId: '' })
              }}><option value="">Chọn gói du thuyền</option>{p.farePackageOfferId && !fare && <option value={p.farePackageOfferId}>Gói đã chọn cần kiểm tra lại</option>}{catalog.offers.map(o => <option key={o.selection.offerId} value={o.selection.offerId}>{o.selection.templateName} · {o.selection.logicalCategory} · {o.selection.amount} USD/người</option>)}</select>
            </Field>
            {fare && <details><summary>Quyền lợi trong gói</summary><ul>{fare.benefits.map(b => <li key={b.sourceBenefitId}>{b.resourceName} · {b.inclusion === 'INCLUDED' ? 'Đã bao gồm' : b.inclusion === 'LIMITED_INCLUDED' ? `Đã bao gồm, giới hạn ${b.quantityLimit} ${b.serviceUnitCode ?? 'lượt'}` : b.inclusion === 'OPTIONAL' ? 'Tùy chọn' : 'Không bao gồm'}{b.requiresReservation && ' · Cần đăng ký riêng'}</li>)}</ul></details>}
            <Field htmlFor={`person-${index}-cabinSelectionMode`} label="Cách chọn cabin *" error={errors[`person-${index}-cabinSelectionMode`]}>
              <select id={`person-${index}-cabinSelectionMode`} value={p.cabinSelectionMode ?? ''} onChange={e => update(index, { cabinSelectionMode: e.target.value ? e.target.value as CabinSelectionMode : undefined, cabinId: '' })}>
                <option value="">Chọn cách nhận cabin</option><option value="PHYSICAL_CABIN">Chọn cabin cụ thể</option><option value="CATEGORY_HOLD">Giữ chỗ theo hạng, chọn cabin sau</option>
              </select>
            </Field>
            {fare && p.cabinSelectionMode && group.members.length > 1 && <Button tone="text" onClick={() => { setApplyFrom(index); setTargets([]) }}>Áp dụng lựa chọn cho người khác trong phòng</Button>}
            {p.cabinSelectionMode === 'CATEGORY_HOLD' && <p className={styles.muted}>Chưa phân cabin cụ thể. Khả năng giữ chỗ cho cả nhóm được kiểm tra khi gửi.</p>}
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
