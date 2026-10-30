import { lazy, Suspense, useId, useState } from 'react'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { cabinTypes, selectedAreas, selectedCabins, type Manifest } from './model'
import styles from './CustomerModel.module.css'

const Canvas = lazy(() => import('./ModelCanvas').then(module => ({ default: module.ModelCanvas })))
export type ModelCabinChoice = { cabinId: string; nodeName: string; remainingCapacity: number }
export type CustomerModelSceneProps = {
  shipId: string; modelId: string; manifest: Manifest
  cabins?: ModelCabinChoice[]; selectedCabinId?: string
  onSelectCabin?: (id: string) => void
}

/** Model nodes describe space; only live booking inventory supplies bookable cabin IDs. */
export function CustomerModelScene({ shipId, modelId, manifest, cabins, selectedCabinId, onSelectCabin }: CustomerModelSceneProps) {
  const id = useId()
  const selectedNode = cabins?.find(cabin => cabin.cabinId === selectedCabinId)?.nodeName
  const initial = manifest.cabins.find(cabin => cabin.nodeName === selectedNode)
  const [deckId, setDeck] = useState(initial?.deckId ?? '')
  const [node, setNode] = useState(initial?.nodeName ?? '')
  const [externalSelection, setExternalSelection] = useState(selectedNode)
  if (externalSelection !== selectedNode) {
    setExternalSelection(selectedNode)
    const next = manifest.cabins.find(value => value.nodeName === selectedNode)
    setNode(next?.nodeName ?? '')
    if (next) setDeck(next.deckId)
  }
  const [search, setSearch] = useState('')
  const decks = manifest.decks
  const deck = decks.find(value => value.id === deckId)
  const cabin = manifest.cabins.find(value => value.nodeName === node)
  const area = manifest.areas?.find(value => value.nodeName === node)
  const choice = cabins?.find(value => value.nodeName === node)
  const cabinList = selectedCabins(manifest, deckId, search)
  const areas = selectedAreas(manifest, deckId, search)
  const file = deck?.asset ?? manifest.assets.exterior ?? manifest.assets.full
  function pick(name: string) {
    const target = manifest.cabins.find(value => value.nodeName === name) ?? manifest.areas?.find(value => value.nodeName === name)
    if (target && decks.some(value => value.id === target.deckId)) { setNode(name); setDeck(target.deckId) }
  }
  return <section className={styles.explorer} aria-label="Khám phá tàu và cabin bằng mô hình 3D">
    <header><p className={styles.eyebrow}>KHÔNG GIAN TRÊN TÀU · 3D</p><h2>{onSelectCabin ? 'Xem vị trí, chọn phòng của bạn' : 'Khám phá từng boong tàu'}</h2><p>Chọn boong, chạm vào cabin hoặc khu vực để xem chi tiết. Bạn cũng có thể chọn bằng danh sách bên dưới.</p></header>
    <div className={styles.controls}>
      <Field htmlFor={`${id}-deck`} label="Boong đang xem"><select id={`${id}-deck`} value={deckId} onChange={event => { setDeck(event.target.value); setNode(''); setSearch('') }}><option value="">Tổng thể tàu</option>{decks.map(value => <option key={value.id} value={value.id}>Boong {value.number} · {value.name}</option>)}</select></Field>
      <Field htmlFor={`${id}-search`} label="Tìm cabin hoặc khu vực"><input id={`${id}-search`} type="search" placeholder="Số phòng, nhà hàng, hồ bơi…" value={search} onChange={event => setSearch(event.target.value)} /></Field>
    </div>
    <div className={styles.scene}>
      {file ? <Suspense fallback={<Loading label="Đang chuẩn bị khung xem 3D…" />}><Canvas key={`${modelId}:${file}`} ship={shipId} model={modelId} file={file} publicModel selected={node} onPick={pick} /></Suspense> : <Notice title="Boong này chưa có mô hình" tone="info">Chọn boong khác hoặc dùng danh sách cabin.</Notice>}
    </div>
    <div className={styles.detail} aria-live="polite">
      {cabin ? <><div><h3>Phòng {cabin.cabinNumber}</h3><p>Boong {cabin.deckNumber} · {cabinTypes[cabin.cabinType] ?? cabin.cabinType}{cabin.capacity != null ? ` · ${cabin.capacity} khách` : ''}</p>{onSelectCabin && <p>{choice && choice.remainingCapacity > 0 ? `Còn ${choice.remainingCapacity} chỗ cho hành khách đang chọn.` : 'Phòng này hiện không khả dụng để đặt cho hành khách đang chọn.'}</p>}</div>{onSelectCabin && <Button disabled={!choice || choice.remainingCapacity < 1} onClick={() => { if (choice && choice.remainingCapacity > 0) onSelectCabin(choice.cabinId) }}>{choice?.cabinId === selectedCabinId ? 'Đã chọn phòng này' : `Chọn phòng ${cabin.cabinNumber}`}</Button>}</> : area ? <div><h3>{area.name}</h3><p>Boong {area.deckNumber} · Khu vực trên tàu</p>{Boolean(area.interiorDetails?.length) && <ul>{area.interiorDetails?.map((value, index) => <li key={index}>{value}</li>)}</ul>}</div> : <p>{deck ? `Đang xem boong ${deck.number} · ${deck.name}.` : 'Đang xem tổng thể tàu.'} Chọn một cabin hoặc khu vực để định vị trên mô hình.</p>}
    </div>
    <div className={styles.lists}>
      <section aria-label="Danh sách cabin trên mô hình"><h3>Cabin · {cabinList.length}</h3><div className={styles.list}>{cabinList.map(value => { const available = cabins?.find(item => item.nodeName === value.nodeName); return <button type="button" key={value.id} aria-pressed={node === value.nodeName} onClick={() => pick(value.nodeName)}><strong>{value.cabinNumber}</strong><span>Boong {value.deckNumber} · {cabinTypes[value.cabinType] ?? value.cabinType}</span>{onSelectCabin && <small>{available && available.remainingCapacity > 0 ? `Còn ${available.remainingCapacity} chỗ` : 'Không khả dụng'}</small>}</button> })}{!cabinList.length && <p>Không có cabin phù hợp. Thử boong khác hoặc đổi từ khóa.</p>}</div></section>
      <section aria-label="Danh sách khu vực trên tàu"><h3>Khu vực · {areas.length}</h3><div className={styles.list}>{areas.map(value => <button type="button" key={value.id} aria-pressed={node === value.nodeName} onClick={() => pick(value.nodeName)}><strong>{value.name}</strong><span>Boong {value.deckNumber}</span></button>)}{!areas.length && <p>Chưa có khu vực phù hợp trên boong đang xem.</p>}</div></section>
    </div>
    <p className={styles.note}>Mô hình giúp tham khảo vị trí và bố cục. {onSelectCabin ? 'Chọn phòng chưa giữ chỗ; hệ thống kiểm tra lại tồn chỗ và giá khi gửi booking.' : 'Dịch vụ và phòng còn chỗ phụ thuộc từng chuyến đi.'}</p>
  </section>
}
