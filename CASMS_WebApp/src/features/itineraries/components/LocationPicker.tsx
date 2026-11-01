import { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice } from '@/shared/ui'
import { findCityCoordinates } from '../api/geocoding-api'
import { countryPortLocations, portCountries, type GeocodingPlace } from '../model/port-location'
import styles from './LocationPicker.module.css'

type Props = { showCountry?:boolean; country: string; city: string; disabled: boolean; countryLocked: boolean; countryError?: string; onCountry: (country: string) => void; onCity: (city: string) => void; onApply: (place: GeocodingPlace) => void }
export function LocationPicker({ showCountry=true,country, city, disabled, countryLocked, countryError, onCountry, onCity, onApply }: Props) {
  const [results, setResults] = useState<GeocodingPlace[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [portCode, setPortCode] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const choices = countryPortLocations(country)
  function reset() { request.current?.abort(); setLoading(false); setResults(null); setSelected(null); setError('') }
  async function search() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError(''); setResults(null); setSelected(null)
    try { const rows = await findCityCoordinates(city, country, controller.signal); if (!controller.signal.aborted) setResults(rows) }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Chưa tra được tọa độ.') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  return <section className={styles.location} aria-label="Quốc gia và thành phố cảng">
    <div className={styles.grid}>
      {showCountry&&<Field htmlFor="master-country" label="Quốc gia / vùng lãnh thổ *" error={countryError}>
        <select id="master-country" required disabled={disabled || countryLocked} value={country} aria-invalid={Boolean(countryError)} onChange={event => { reset(); setPortCode(''); onCountry(event.target.value) }}>
          <option value="">Chọn quốc gia</option>
          {country && !portCountries.some(item => item.code === country) && <option value={country}>{country} (dữ liệu hiện có)</option>}
          {portCountries.map(item => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}
        </select>
      </Field>}
      <Field htmlFor="master-featured-port" label="Gợi ý địa danh để tra tọa độ" hint="Gợi ý tìm kiếm, không phải danh mục cảng đã lưu trong CASMS.">
        <select id="master-featured-port" value={portCode} disabled={disabled || !country} onChange={event => { reset(); setPortCode(event.target.value); onCity(choices.find(item => item.code === event.target.value)?.searchName ?? '') }}>
          <option value="">Chọn cảng du lịch</option>{choices.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
      </Field>
      <Field htmlFor="master-city" label="Thành phố / đảo để tra tọa độ" hint="Tên địa điểm được điền từ cảng gợi ý; có thể đổi để tìm địa điểm khác.">
        <input id="master-city" maxLength={200} value={city} disabled={disabled || !country} onChange={event => { reset(); setPortCode(''); onCity(event.target.value) }} placeholder="Ví dụ: Ha Long" />
      </Field>
    </div>
    <Button tone="secondary" disabled={disabled || loading || !country || city.trim().length < 2} onClick={() => void search()}>{loading ? 'Đang tra tọa độ…' : 'Tra tọa độ'}</Button>
    {error && <Notice title="Chưa tra được tọa độ" tone="error">{error}</Notice>}
    {results?.length === 0 && <p role="status">Không tìm thấy thành phố hoặc đảo trong quốc gia đã chọn. Thử tên không dấu hoặc tên tiếng Anh; dữ liệu biểu mẫu được giữ nguyên.</p>}
    {Boolean(results?.length) && <div className={styles.results} role="group" aria-label="Chọn kết quả tọa độ">{results?.map(place => <button type="button" className={styles.result} key={place.id} disabled={disabled} aria-pressed={selected === place.id} onClick={() => { setSelected(place.id); onApply(place) }}><strong>{place.name}</strong><span>{place.kind === 'ISLAND' ? 'Đảo' : place.kind==='CITY'?'Thành phố':'Địa danh'} · {place.region}{place.countryCode?` · ${place.countryCode}`:''}</span><span>{place.latitude}, {place.longitude}{place.timeZoneId?` · ${place.timeZoneId}`:''}</span><span>{selected === place.id ? 'Đã áp dụng' : 'Dùng tọa độ này'}</span></button>)}</div>}
    <p className={styles.note}>Tọa độ địa danh tham chiếu; không phải vị trí chính xác của terminal, cầu cảng, bến tàu hoặc bến neo. Location data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> via <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
  </section>
}
