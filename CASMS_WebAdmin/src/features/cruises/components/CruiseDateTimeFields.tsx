import { useRef, useState } from 'react'
import { Button, Field } from '@/shared/ui'
import { parseCruiseDate, validCruiseClock } from '../model/cruise-validation'
import styles from './Cruises.module.css'

const QUICK_CLOCKS = ['08:00', '09:00', '12:00', '16:00']

function PickerButton({
  type,
  value,
  min,
  max,
  text,
  label,
  onSelect,
}: {
  type: 'date' | 'time'
  value: string
  min?: string
  max?: string
  text: string
  label: string
  onSelect: (value: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(false)

  function openPicker() {
    const control = input.current
    if (!control) return
    try {
      control.showPicker()
    } catch {
      setExpanded(true)
      requestAnimationFrame(() => input.current?.focus())
    }
  }

  return (
    <span className={expanded ? styles.pickerExpanded : styles.pickerSlot}>
      {!expanded && (
        <Button type="button" tone="secondary" autoWidth aria-label={label} onClick={openPicker}>
          {text}
        </Button>
      )}
      <input
        ref={input}
        type={type}
        value={value}
        min={min}
        max={max}
        aria-label={label}
        aria-hidden={!expanded}
        className={expanded ? undefined : styles.pickerAnchor}
        tabIndex={expanded ? 0 : -1}
        onChange={event => {
          if (event.target.value) onSelect(event.target.value)
        }}
      />
    </span>
  )
}

export function CruiseDateTimeFields({
  id,
  label,
  value,
  error,
  templateClock,
  minDate,
  maxDate,
  onChange,
  onIncompleteChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  templateClock?: string
  minDate?: string
  maxDate?: string
  onChange: (value: string) => void
  onIncompleteChange?: (incomplete: boolean) => void
}) {
  const normalizedSuggested = templateClock && validCruiseClock(templateClock) ? templateClock.replace(/^(\d{2}:\d{2}):00$/, '$1') : undefined
  const [isoDate, initialClock] = value.split('T')
  const [date, setDate] = useState(() => isoDate.split('-').reverse().join('/'))
  const [clock, setClock] = useState(() => initialClock?.replace(/^(\d{2}:\d{2}):00$/, '$1') || normalizedSuggested || '')
  const [dateTouched, setDateTouched] = useState(false)
  const [clockTouched, setClockTouched] = useState(false)

  const parsedDay = parseCruiseDate(date)

  const dateError = dateTouched && !parsedDay ? 'Nhập ngày hợp lệ theo dạng 25/04/2028.' : undefined
  const clockError =
    clockTouched && !validCruiseClock(clock)
      ? 'Nhập giờ theo dạng 24 tiếng, ví dụ 08:30 hoặc 16:00.'
      : undefined

  function apply(nextDate: string, nextClock: string) {
    const day = parseCruiseDate(nextDate)
    const time = nextClock.trim()
    const next = day && validCruiseClock(time) ? `${day}T${time}` : ''
    onIncompleteChange?.(!next && Boolean(nextDate.trim() || time))
    if (next !== value) onChange(next)
  }

  function changeDate(nextDate: string) {
    setDate(nextDate)
    apply(nextDate, clock)
  }

  function changeClock(nextClock: string) {
    setClock(nextClock)
    apply(date, nextClock)
  }

  function applyTemplateClock() {
    if (!normalizedSuggested) return
    setClockTouched(false)
    setClock(normalizedSuggested)
    apply(date, normalizedSuggested)
  }

  const isUsingTemplateClock = Boolean(normalizedSuggested && clock.trim() === normalizedSuggested)

  const clockHint = normalizedSuggested
    ? `Đã điền sẵn theo giờ mẫu (${normalizedSuggested}). Có thể chọn nhanh hoặc nhập giờ khác.`
    : 'Nhập theo định dạng 24 tiếng (ví dụ 08:00, 16:00) hoặc chọn nhanh.'

  return (
    <div className={styles.departureDateTime}>
      <div className={styles.pickerField}>
        <Field
          htmlFor={id}
          label={`Ngày ${label} *`}
          hint="Định dạng DD/MM/YYYY, ví dụ 25/04/2028"
          error={dateError}
        >
          <input
            id={id}
            value={date}
            required
            autoComplete="off"
            maxLength={10}
            placeholder="DD/MM/YYYY"
            onBlur={() => {
              if (date) setDateTouched(true)
            }}
            onChange={event => changeDate(event.target.value)}
          />
          <PickerButton
            type="date"
            value={parsedDay ?? ''}
            min={minDate}
            max={maxDate}
            text="Chọn ngày"
            label={`Chọn ngày ${label}`}
            onSelect={selected => changeDate(selected.split('-').reverse().join('/'))}
          />
        </Field>
      </div>

      <div className={styles.pickerField}>
        <Field
          htmlFor={id + '-clock'}
          label={`Giờ ${label} (giờ Việt Nam) *`}
          hint={clockHint}
          error={clockError ?? error}
        >
          <input
            id={id + '-clock'}
            value={clock}
            required
            autoComplete="off"
            maxLength={8}
            placeholder="HH:MM"
            onBlur={() => {
              if (clock) setClockTouched(true)
            }}
            onChange={event => changeClock(event.target.value)}
          />
          <PickerButton
            type="time"
            value={validCruiseClock(clock) ? clock.trim() : ''}
            text="Chọn giờ"
            label={`Chọn giờ ${label}`}
            onSelect={changeClock}
          />
        </Field>

        <div className={styles.clockQuickActions} role="group" aria-label="Chọn nhanh giờ khởi hành">
          {normalizedSuggested && (
            <button
              type="button"
              className={`${styles.clockQuickBtn} ${styles.clockTemplateBtn} ${isUsingTemplateClock ? styles.clockQuickBtnActive : ''}`}
              aria-pressed={isUsingTemplateClock}
              onClick={applyTemplateClock}
            >
              {isUsingTemplateClock
                ? `Giờ mẫu (${normalizedSuggested})`
                : `Dùng giờ mẫu (${normalizedSuggested})`}
            </button>
          )}
          {QUICK_CLOCKS.filter(preset => preset !== normalizedSuggested).map(preset => {
            const active = clock.trim() === preset
            return (
              <button
                key={preset}
                type="button"
                className={`${styles.clockQuickBtn} ${active ? styles.clockQuickBtnActive : ''}`}
                aria-pressed={active}
                onClick={() => changeClock(preset)}
              >
                {preset}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
