import { Empty, Field } from '@/shared/ui'
import { useState } from 'react'
import type { AvailableCabin } from '../api/real-booking-api'
import { cabinTypeName } from '../model/booking-presentation'
import styles from './BookingParty.module.css'

export function BookingCabinChoices({ cabins, selectedCabinId, onSelect, name, error }: {
  cabins: AvailableCabin[]; selectedCabinId?: string; onSelect: (id: string) => void; name: string; error?: string
}) {
  const [deck, setDeck] = useState('')
  const decks = [...new Set(cabins.map(c => c.deckName || (c.deckNumber == null ? '' : `Boong ${c.deckNumber}`)).filter(Boolean))]
  const visible = cabins.filter(c => !deck || (c.deckName || `Boong ${c.deckNumber}`) === deck)
  return <div className={styles.section}>
    {decks.length > 1 && <Field htmlFor={`${name}-deck`} label="Boong"><select id={`${name}-deck`} value={deck} onChange={e => setDeck(e.target.value)}><option value="">Tất cả boong phù hợp</option>{decks.map(d => <option key={d}>{d}</option>)}</select></Field>}
    <fieldset className={styles.choices} id={name} tabIndex={error ? -1 : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>
      <legend>Chọn cabin</legend>
      {visible.map(cabin => <label className={styles.cabin} key={cabin.cabinId}>
        <input type="radio" name={name} value={cabin.cabinId} checked={cabin.cabinId === selectedCabinId} onChange={() => onSelect(cabin.cabinId)} />
        <span><strong>Cabin {cabin.cabinNumber}</strong><small>{[cabin.deckName || (cabin.deckNumber == null ? null : `Boong ${cabin.deckNumber}`), cabin.cabinType ? cabinTypeName(cabin.cabinType) : null, `Sức chứa ${cabin.capacity} khách`, cabin.isAccessible === true ? 'Hỗ trợ tiếp cận' : null].filter(Boolean).join(' · ')}</small></span>
      </label>)}
    </fieldset>
    {error && <p id={`${name}-error`} role="alert">{error}</p>}
    {!visible.length && <Empty title="Không có cabin phù hợp"><p>Kiểm tra gói, số người ở chung hoặc bộ lọc boong.</p></Empty>}
  </div>
}
