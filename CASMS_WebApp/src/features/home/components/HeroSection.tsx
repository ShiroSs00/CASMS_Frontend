import { useEffect, useState, useSyncExternalStore } from 'react'
import { asianPorts } from '../model/asian-ports'
import styles from './Landing.module.css'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const pageHidden = () => document.hidden

export function HeroSection() {
  const [active, setActive] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => true)
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, () => false)
  const rotating = autoplay && !reduce && !hidden && !hovered && !focused
  const port = asianPorts[active]

  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setActive(index => (index + 1) % asianPorts.length), 6500)
    return () => window.clearInterval(timer)
  }, [rotating, active])

  function select(index: number) {
    setAutoplay(false)
    setActive((index + asianPorts.length) % asianPorts.length)
  }

  return <section className={styles.hero} aria-labelledby="home-title" aria-roledescription="trình chiếu"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className={styles.heroSlides} aria-hidden="true">
      {asianPorts.map((slide, index) => <img key={slide.id} src={slide.image} alt="" width="1600" height="1000"
        className={index === active ? styles.heroSlideActive : styles.heroSlide}
        style={{ objectPosition: slide.position }} decoding="async" fetchPriority={index === 0 ? 'high' : 'low'} />)}
    </div>
    <div className={styles.heroShade} />
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>OceVie · NHỮNG HẢI TRÌNH CHÂU Á</p>
      <h1 id="home-title">Mỗi bến cảng,<br />một hành trình mới.</h1>
      <p className={styles.heroSubtitle}>Từ những đường chân trời rực sáng đến bến cảng bình yên. Tìm chuyến du thuyền, chọn phòng và bắt đầu kỳ nghỉ theo cách của bạn.</p>
      <div className={styles.heroActions}><a className={styles.primary} href="#cruise-finder">Khám phá hành trình <span aria-hidden="true">↗</span></a><a className={styles.secondary} href="#destinations">Cảm hứng điểm đến</a></div>
    </div>
    <div className={styles.heroBottom}>
      <div className={styles.heroPort} aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
        <p className={styles.heroPortEyebrow}>GÓC NHÌN TỪ BẾN CẢNG · {String(active + 1).padStart(2, '0')} / {String(asianPorts.length).padStart(2, '0')}</p>
        <h2>{port.name}</h2><p>{port.location} · {port.country}</p>
        <span className={styles.heroPhotoDescription}>{port.alt}</span>
      </div>
      <div className={styles.heroControls} role="group" aria-label="Điều khiển ảnh cảng châu Á">
        <button type="button" onClick={() => select(active - 1)} aria-label="Ảnh cảng trước">←</button>
        <div className={styles.heroDots}>{asianPorts.map((slide, index) => <button type="button" key={slide.id} aria-label={`Xem ảnh ${slide.name}, ${slide.location}`} aria-pressed={index === active} onClick={() => select(index)}><span /></button>)}</div>
        <button type="button" onClick={() => select(active + 1)} aria-label="Ảnh cảng tiếp theo">→</button>
        {!reduce && <button type="button" aria-label={autoplay ? 'Tạm dừng trình chiếu' : 'Bật tự động trình chiếu'} aria-pressed={autoplay} onClick={() => setAutoplay(value => !value)}>{autoplay ? 'Ⅱ' : '▶'}</button>}
      </div>
      <p className={styles.heroCredit}><a href={port.source} target="_blank" rel="noreferrer">Ảnh: {port.author}</a> · <a href={port.licenseUrl} target="_blank" rel="noreferrer">{port.license}</a></p>
    </div>
  </section>
}
