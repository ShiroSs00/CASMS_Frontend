import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AdminFrame, Button, Notice, PageHeader, Panel } from '@/shared/ui'
import { useAdminData, useMutation } from '../hooks/useAdminData'
import { MockValidationError, shipDeckCabinAdapter } from '../mocks/adapter'
import { cabinStatuses, cabinTypes, kindLabels, sectionLabels, shipStatuses } from '../model/types'
import type { Cabin, CabinDraft, CabinStatus, CabinType, DataSnapshot, Deck, DeckDraft, EntityKind, FieldErrors, Ship, ShipDraft, ShipStatus } from '../model/types'
import { DataState, InputField, NotFound, SelectField } from '../components/Common'
import styles from '../components/Management.module.css'

function FormContent({ kind, data, ship, deck, cabin, hostId }:
  { kind: EntityKind; data: DataSnapshot; ship?: Ship; deck?: Deck; cabin?: Cabin; hostId: string }) {
  const navigate = useNavigate()
  const source = ship ?? deck ?? cabin
  const [shipDraft, setShip] = useState<ShipDraft>(ship ?? { code: '', name: '', capacity: 0, totalDecks: 0, commissionDate: '', status: 'INACTIVE' })
  const [deckDraft, setDeck] = useState<DeckDraft>(deck ?? { shipId: hostId, number: 0, name: '' })
  const [cabinDraft, setCabin] = useState<CabinDraft>(cabin ?? { shipId: hostId, deckId: '', number: '', type: 'INTERIOR', capacity: 0, status: 'AVAILABLE', accessible: false })
  const [errors, setErrors] = useState<FieldErrors>({})
  const mutation = useMutation()
  const form = useRef<HTMLFormElement>(null)
  const clearError = (key: string) => setErrors((current) => ({ ...current, [key]: '' }))
  const changeShip = <K extends keyof ShipDraft>(key: K, value: ShipDraft[K]) => { setShip((current) => ({ ...current, [key]: value })); clearError(key) }
  const changeDeck = <K extends keyof DeckDraft>(key: K, value: DeckDraft[K]) => { setDeck((current) => ({ ...current, [key]: value })); clearError(key) }
  const changeCabin = <K extends keyof CabinDraft>(key: K, value: CabinDraft[K]) => { setCabin((current) => ({ ...current, [key]: value, ...(key === 'shipId' ? { deckId: '' } : {}) })); clearError(key) }
  const focusError = () => requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mutation.busy) return
    const validation = kind === 'ships' ? shipDeckCabinAdapter.validateShip(shipDraft, source?.id)
      : kind === 'decks' ? shipDeckCabinAdapter.validateDeck(deckDraft, source?.id) : shipDeckCabinAdapter.validateCabin(cabinDraft, source?.id)
    setErrors(validation)
    if (Object.keys(validation).length) { focusError(); return }
    void mutation.run(async () => {
      try {
        const saved = kind === 'ships' ? await shipDeckCabinAdapter.saveShip(shipDraft, source?.id, source?.version)
          : kind === 'decks' ? await shipDeckCabinAdapter.saveDeck(deckDraft, source?.id, source?.version)
            : await shipDeckCabinAdapter.saveCabin(cabinDraft, source?.id, source?.version)
        navigate(`/admin/${kind}/${saved.id}`, { state: { saved: true } })
      } catch (error) {
        if (error instanceof MockValidationError) { setErrors(error.fields); focusError() }
        throw error
      }
    })
  }
  const hostOptions = <><option value="">Chọn tàu</option>{data.ships.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</>
  const occupied = cabin?.status === 'OCCUPIED'
  return <>
    <PageHeader breadcrumb={`Vận hành / Tàu & đội tàu / ${sectionLabels[kind]} / ${source ? 'Chỉnh sửa' : 'Tạo mới'}`} title={`${source ? 'Chỉnh sửa' : kind === 'ships' ? 'Tạo' : 'Thêm'} ${kindLabels[kind]}`}
      description="Điền thông tin bên dưới. Dữ liệu được lưu trong phiên demo hiện tại." />
    <div className={styles.stack}>
      {source && kind === 'ships' && <Notice title="Mã tàu được bảo vệ">Mã tàu không thay đổi sau khi tạo. Đổi trạng thái tại màn hình chi tiết.</Notice>}
      {source && kind === 'cabins' && <Notice title={occupied ? 'Cabin đang có khách' : 'Trạng thái vận hành'} tone={occupied ? 'warning' : 'info'}>{occupied ? 'Chỉnh sửa bị khóa trong kịch bản mock này. Lịch sử và thông tin vẫn có thể xem tại chi tiết.' : 'Trạng thái được thay đổi bằng thao tác vận hành tại màn hình chi tiết.'}</Notice>}
      {mutation.error && <Notice title="Không lưu được dữ liệu" tone="error">{mutation.error}</Notice>}
      <form noValidate ref={form} onSubmit={submit}>
        <Panel title={`Thông tin ${kindLabels[kind]}`}>
          <div className={styles.grid}>
            {kind === 'ships' ? <>
              <InputField label="Mã tàu *" value={shipDraft.code} maxLength={20} readOnly={Boolean(ship)} disabled={mutation.busy} error={errors.code} onChange={(event) => changeShip('code', event.target.value.toUpperCase())} placeholder="VD: CAS-AUR-04" />
              <InputField label="Tên tàu *" value={shipDraft.name} maxLength={100} disabled={mutation.busy} error={errors.name} onChange={(event) => changeShip('name', event.target.value)} />
              <SelectField label="Trạng thái *" value={shipDraft.status} disabled={mutation.busy || Boolean(ship)} error={errors.status} onChange={(value) => changeShip('status', value as ShipStatus)}>{Object.entries(shipStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
              <InputField label="Sức chứa hành khách *" type="number" min={1} step={1} value={shipDraft.capacity || ''} disabled={mutation.busy} error={errors.capacity} onChange={(event) => changeShip('capacity', Number(event.target.value))} />
              <InputField label="Tổng số boong *" type="number" min={1} step={1} value={shipDraft.totalDecks || ''} disabled={mutation.busy} error={errors.totalDecks} onChange={(event) => changeShip('totalDecks', Number(event.target.value))} />
              <InputField label="Ngày đưa vào hoạt động" type="date" value={shipDraft.commissionDate} disabled={mutation.busy} error={errors.commissionDate} onChange={(event) => changeShip('commissionDate', event.target.value)} hint="Không bắt buộc." />
            </> : kind === 'decks' ? <>
              <SelectField label="Tàu *" value={deckDraft.shipId} disabled={mutation.busy || Boolean(deck)} error={errors.shipId} onChange={(value) => changeDeck('shipId', value)}>{hostOptions}</SelectField>
              <InputField label="Số boong *" type="number" min={1} step={1} max={data.ships.find((row) => row.id === deckDraft.shipId)?.totalDecks} value={deckDraft.number || ''} disabled={mutation.busy} error={errors.number} onChange={(event) => changeDeck('number', Number(event.target.value))} hint={deckDraft.shipId ? `Giới hạn theo tàu: ${data.ships.find((row) => row.id === deckDraft.shipId)?.totalDecks ?? 0} boong.` : 'Chọn tàu trước khi nhập số boong.'} />
              <InputField label="Tên boong" maxLength={50} value={deckDraft.name} disabled={mutation.busy} error={errors.name} onChange={(event) => changeDeck('name', event.target.value)} hint="Không bắt buộc, tối đa 50 ký tự." />
            </> : <>
              <SelectField label="Tàu *" value={cabinDraft.shipId} disabled={mutation.busy || Boolean(cabin)} error={errors.shipId} onChange={(value) => changeCabin('shipId', value)}>{hostOptions}</SelectField>
              <SelectField label="Boong *" value={cabinDraft.deckId} disabled={mutation.busy || occupied} error={errors.deckId} onChange={(value) => changeCabin('deckId', value)}><option value="">Chọn boong</option>{data.decks.filter((row) => row.shipId === cabinDraft.shipId).map((row) => <option value={row.id} key={row.id}>Boong {row.number} · {row.name || 'Chưa đặt tên'}</option>)}</SelectField>
              <InputField label="Số cabin *" maxLength={10} value={cabinDraft.number} disabled={mutation.busy || occupied} error={errors.number} onChange={(event) => changeCabin('number', event.target.value)} hint="Duy nhất trong cùng tàu." />
              <SelectField label="Loại cabin *" value={cabinDraft.type} disabled={mutation.busy || occupied} error={errors.type} onChange={(value) => changeCabin('type', value as CabinType)}>{Object.entries(cabinTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</SelectField>
              <InputField label="Sức chứa *" type="number" min={1} step={1} value={cabinDraft.capacity || ''} disabled={mutation.busy || occupied} error={errors.capacity} onChange={(event) => changeCabin('capacity', Number(event.target.value))} />
              <SelectField label="Trạng thái *" value={cabinDraft.status} disabled={mutation.busy || Boolean(cabin)} error={errors.status} onChange={(value) => changeCabin('status', value as CabinStatus)}>{Object.entries(cabinStatuses).filter(([value]) => Boolean(cabin) || value !== 'OCCUPIED').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</SelectField>
              <label className={`${styles.check} ${styles.full}`}><input type="checkbox" checked={cabinDraft.accessible} disabled={mutation.busy || occupied} onChange={(event) => changeCabin('accessible', event.target.checked)} />Hỗ trợ người khuyết tật / tiếp cận</label>
              {!data.decks.some((row) => row.shipId === cabinDraft.shipId) && cabinDraft.shipId && <div className={styles.full}><Notice title="Tàu chưa có boong" tone="warning">Tạo boong cho tàu trước khi thêm cabin. <Link className={styles.link} to={`/admin/decks/new?ship=${cabinDraft.shipId}`}>Thêm boong</Link></Notice></div>}
            </>}
          </div>
          <div className={styles.actions}><Button type="submit" disabled={mutation.busy || occupied}>{mutation.busy ? 'Đang lưu…' : `Lưu ${kindLabels[kind]}`}</Button><Button tone="secondary" disabled={mutation.busy} onClick={() => navigate(source ? `/admin/${kind}/${source.id}` : `/admin/${kind}${hostId && kind !== 'ships' ? `?ship=${hostId}` : ''}`)}>Hủy</Button></div>
        </Panel>
      </form>
    </div>
  </>
}
function FormPage({ kind }: { kind: EntityKind }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, loading, error, retry } = useAdminData()
  if (loading || error || !data) return <DataState loading={loading} error={error} retry={retry} />
  if (id && !data[kind].some((row) => row.id === id)) return <NotFound back={`/admin/${kind}`} />
  return <FormContent key={`${kind}:${id ?? 'new'}`} kind={kind} data={data} hostId={params.get('ship') ?? ''}
    ship={kind === 'ships' ? data.ships.find((row) => row.id === id) : undefined}
    deck={kind === 'decks' ? data.decks.find((row) => row.id === id) : undefined}
    cabin={kind === 'cabins' ? data.cabins.find((row) => row.id === id) : undefined} />
}
export function ShipFormPage() { return <AdminFrame><FormPage kind="ships" /></AdminFrame> }
export function DeckFormPage() { return <AdminFrame><FormPage kind="decks" /></AdminFrame> }
export function CabinFormPage() { return <AdminFrame><FormPage kind="cabins" /></AdminFrame> }
