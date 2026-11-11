import { Button, Empty, Field } from '@/shared/ui'
import { useState } from 'react'
import type { AvailableCabin } from '../api/real-booking-api'
import { cabinTypeName } from '../model/booking-presentation'
import styles from './BookingParty.module.css'

export function BookingCabinChoices({ cabins, selectedCabinId, onSelect, name, error }: {
  cabins: AvailableCabin[]; selectedCabinId?: string; onSelect: (id: string) => void; name: string; error?: string
}) {
  const [deck, setDeck] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const choicesId = `${name}-choices`
  const decks = [...new Set(cabins.map(c => c.deckName || (c.deckNumber == null ? '' : `Boong ${c.deckNumber}`)).filter(Boolean))]
  const matching = cabins.filter(c => (!deck || (c.deckName || `Boong ${c.deckNumber}`) === deck) && c.cabinNumber.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
  const pageSize = 12
  const lastPage = Math.max(0, Math.ceil(matching.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const visible = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const selected = cabins.find(c => c.cabinId === selectedCabinId)
  function changePage(next: number) {
    setPage(next)
    document.getElementById(choicesId)?.focus()
  }
  return <div className={styles.section}>
    <div className={styles.cabinFilters}>
      <Field htmlFor={`${name}-search`} label="Tìm số cabin"><input id={`${name}-search`} type="search" autoComplete="off" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></Field>
      {decks.length > 1 && <Field htmlFor={`${name}-deck`} label="Boong"><select id={`${name}-deck`} value={deck} onChange={e => { setDeck(e.target.value); setPage(0) }}><option value="">Tất cả boong phù hợp</option>{decks.map(d => <option key={d}>{d}</option>)}</select></Field>}
    </div>
    {selected && <p className={styles.cabinSelected} role="status">Đã chọn: <strong>Cabin {selected.cabinNumber}</strong> · {selected.cabinType ? cabinTypeName(selected.cabinType) : 'Chưa có hạng cabin'}</p>}
    <p id={`${name}-count`} className={styles.muted} role="status">{matching.length ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, matching.length)} / ${matching.length} cabin phù hợp` : 'Không tìm thấy cabin phù hợp'}</p>
    <div id={choicesId} tabIndex={-1} className={styles.cabinResults}>
    <fieldset className={styles.choices} id={name} tabIndex={error ? -1 : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
      <legend>Chọn cabin</legend>
      {visible.map(cabin => <label className={styles.cabin} key={cabin.cabinId}>
        <input type="radio" name={name} value={cabin.cabinId} checked={cabin.cabinId === selectedCabinId} onChange={() => onSelect(cabin.cabinId)} />
        <span><strong>Cabin {cabin.cabinNumber}</strong><small>{[cabin.deckName || (cabin.deckNumber == null ? null : `Boong ${cabin.deckNumber}`), cabin.cabinType ? cabinTypeName(cabin.cabinType) : null, `Sức chứa ${cabin.capacity} khách`, cabin.isAccessible === true ? 'Hỗ trợ tiếp cận' : null].filter(Boolean).join(' · ')}</small></span>
      </label>)}
    </fieldset>
    </div>
    {lastPage > 0 && <nav className={styles.cabinPagination} aria-label="Trang cabin">
      <Button tone="secondary" disabled={currentPage === 0} aria-controls={choicesId} onClick={() => changePage(currentPage - 1)}>Cabin trước</Button>
      <span>Trang {currentPage + 1} / {lastPage + 1}</span>
      <Button tone="secondary" disabled={currentPage === lastPage} aria-controls={choicesId} onClick={() => changePage(currentPage + 1)}>Cabin tiếp</Button>
    </nav>}
    {error && <p id={`${name}-error`} role="alert">{error}</p>}
    {!matching.length && <Empty title="Không có cabin phù hợp"><p>Thử số cabin khác hoặc đổi bộ lọc boong.</p><Button tone="secondary" onClick={() => { setSearch(''); setDeck(''); setPage(0) }}>Xóa bộ lọc cabin</Button></Empty>}
  </div>
}
