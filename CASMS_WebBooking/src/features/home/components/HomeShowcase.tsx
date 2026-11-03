import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { homeCruiseSearch, homeCruiseType } from '../model/public-booking'
import styles from './HomeShowcase.module.css'

const heroSlides = [
  { src:'/images/ports/ha-long-bay.webp', alt:'Những đảo đá vôi và du thuyền trên Vịnh Hạ Long', label:'Vịnh Hạ Long, Việt Nam' },
  { src:'/images/ports/da-nang-panorama.webp', alt:'Sông Hàn nhìn từ cầu Rồng tại Đà Nẵng lúc bình minh', label:'Đà Nẵng, Việt Nam' },
  { src:'/images/ports/yokohama-osanbashi.webp', alt:'Nhà ga du thuyền Ōsanbashi tại Yokohama lúc hoàng hôn', label:'Yokohama, Nhật Bản' },
  { src:'/images/ports/singapore-marina-bay.webp', alt:'Marina Bay Cruise Centre tại Singapore', label:'Marina Bay, Singapore' },
  { src:'/images/ports/kobe-port.webp', alt:'Toàn cảnh cảng Kobe tại Nhật Bản', label:'Kobe, Nhật Bản' },
  { src:'/images/ports/kyushu-nagasaki.webp', alt:'Cảng Nagasaki trên đảo Kyushu', label:'Nagasaki, Nhật Bản' },
  { src:'/images/ports/keelung-harbour.webp', alt:'Cảng Keelung và các tòa nhà ven bờ', label:'Keelung, Đài Loan' },
]
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
const pageHidden = () => document.hidden

export function HomeHero() {
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const [loaded, setLoaded] = useState<number[]>([])
  const reduce = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true)
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, () => false)
  const rotating = !reduce && !hidden && !focused
  useEffect(() => {
    if (!rotating) return
    const timer = window.setInterval(() => setActive(index => loaded.includes((index+1)%heroSlides.length) ? (index+1)%heroSlides.length : index), 6500)
    return () => window.clearInterval(timer)
  }, [rotating, loaded])
  return <section className={styles.hero} aria-labelledby="home-title" aria-roledescription="trình chiếu" onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className={styles.heroImages} aria-hidden="true">{heroSlides.map((slide,index) => <img key={slide.src} className={`${styles.heroPhoto} ${index === active ? styles.slideActive : styles.slideHidden}`} src={slide.src} alt="" width="1600" height="1067" fetchPriority={index === 0 ? 'high' : 'low'} onLoad={() => setLoaded(items => items.includes(index) ? items : [...items,index])} />)}</div>
    <div className={styles.heroShade} />
    <div className={styles.heroInner}>
      <p className={styles.eyebrow}>OCEVIE CRUISES · HẢI TRÌNH CHÂU Á</p>
      <h1 id="home-title">Khám phá biển trời.<br /><span>Tận hưởng kỳ nghỉ.</span></h1>
      <p>Khám phá những điểm đến châu Á và tìm hành trình phù hợp cho kỳ nghỉ của bạn cùng OceVie.</p>
      <div className={styles.heroActions}><a className={styles.goldButton} href="#cruise-finder">Tìm hành trình <span aria-hidden="true">↗</span></a><Link className={styles.lightLink} to="/destinations">Khám phá điểm đến <span aria-hidden="true">→</span></Link></div>
    </div>
    <div className={styles.heroFoot}><span>DI SẢN VIỆT NAM · KỲ NGHỈ TRÊN BIỂN</span><div className={styles.slideshow}><p aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">Ảnh địa danh · {heroSlides[active].label}<span className={styles.screenReader}> · {heroSlides[active].alt}</span></p></div></div>
  </section>
}

export function HomeFinder() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const cruiseType = homeCruiseType(params.get('cruiseType'))
  return <section className={styles.finder} id="cruise-finder" aria-labelledby="home-finder-title">
    <div className={styles.finderIntro}><p className={styles.eyebrow}>TÌM CHUYẾN DU THUYỀN</p><h2 id="home-finder-title">Chọn hành trình cho kỳ nghỉ của bạn</h2><p id="home-finder-help">Chọn chuyến ngắn ngày hoặc dài ngày để xem lịch khởi hành và phòng còn trống.</p></div>
    <form onSubmit={event => { event.preventDefault(); navigate(homeCruiseSearch(cruiseType)) }}>
      <label htmlFor="home-cruise-type"><span id="home-cruise-type-label">Loại hành trình</span><select id="home-cruise-type" name="cruiseType" aria-labelledby="home-cruise-type-label" value={cruiseType} aria-describedby="home-finder-help" onChange={event => { const query = new URLSearchParams(params); if (event.target.value) query.set('cruiseType', event.target.value); else query.delete('cruiseType'); setParams(query, { replace: true, preventScrollReset: true }) }}><option value="">Tất cả hành trình</option><option value="ONE_DAY">Chuyến ngắn ngày (1–2 ngày)</option><option value="MULTI_DAYS">Chuyến dài ngày (3–5 ngày)</option></select></label>
      <button type="submit" className={styles.navyButton}>Tìm chuyến <span aria-hidden="true">→</span></button>
    </form>
  </section>
}

export function HolidayChoices() {
  return <section className={styles.choices} aria-labelledby="holiday-title">
    <div className={styles.sectionHead}><div><p className={styles.eyebrow}>MỘT KỲ NGHỈ, NHIỀU CÁCH KHÁM PHÁ</p><h2 id="holiday-title">Kỳ nghỉ theo cách của bạn.</h2></div><p>Lựa chọn chuyến ngắn ngày để đổi gió hoặc hành trình dài ngày để dành thêm thời gian khám phá.</p></div>
    <div className={styles.choiceGrid}>
      <Link className={styles.choice} to="/cruises?cruiseType=ONE_DAY"><div className={styles.choicePhoto}><img src="/images/ports/da-nang-panorama.webp" alt="Sông Hàn, Đà Nẵng lúc bình minh" width="1600" height="825" loading="lazy" /><span>Ảnh cảm hứng · Đà Nẵng</span></div><div className={styles.choiceCopy}><span className={styles.eyebrow}>01 / CHUYẾN NGẮN NGÀY</span><h3>Đổi gió với chuyến ngắn ngày.</h3><p>Khám phá hành trình 1–2 ngày.</p><span className={styles.roundArrow} aria-hidden="true">↗</span></div></Link>
      <Link className={styles.choice} to="/cruises?cruiseType=MULTI_DAYS"><div className={styles.choicePhoto}><img src="/images/ports/yokohama-osanbashi.webp" alt="Cảng Ōsanbashi ở Yokohama, Nhật Bản" width="1600" height="1000" loading="lazy" /><span>Ảnh cảm hứng · Yokohama</span></div><div className={styles.choiceCopy}><span className={styles.eyebrow}>02 / CHUYẾN DÀI NGÀY</span><h3>Khám phá nhiều hơn với chuyến dài ngày.</h3><p>Khám phá hành trình 3–5 ngày.</p><span className={styles.roundArrow} aria-hidden="true">↗</span></div></Link>
    </div>
  </section>
}

export function HomeShipInvitation() {
  return <section className={styles.ship} aria-labelledby="home-ship-title">
    <div className={styles.shipPhoto}><img src="/images/ports/singapore-marina-bay.webp" alt="Tàu cập Marina Bay Cruise Centre tại Singapore; ảnh địa danh" width="1600" height="1000" loading="lazy" /><span>Marina Bay, Singapore · Ảnh cảm hứng</span></div>
    <div className={styles.shipCopy}><p className={styles.eyebrow}>OCEVIE · TÀU & KHÔNG GIAN</p><h2 id="home-ship-title">Một góc nhìn mới,<br />từ phía biển.</h2><p>Con tàu là một phần của hành trình. Tìm hiểu thông tin tàu, lịch trình và lựa chọn phòng theo từng chuyến trước khi quyết định.</p><Link className={styles.goldButton} to="/ships">Khám phá tàu & không gian <span aria-hidden="true">↗</span></Link></div>
  </section>
}

export function HomeBookingAccess() {
  return <section className={styles.booking} id="journey" aria-labelledby="home-lookup-title">
    <div><p className={styles.eyebrow}>ĐÃ CÓ MÃ ĐẶT CHỖ?</p><h2 id="home-lookup-title">Sẵn sàng cho ngày ra khơi.</h2><p>Tra cứu bằng mã đặt chỗ cùng email hoặc số điện thoại của người đại diện. Xem lại thông tin hành khách, phòng và hướng dẫn hợp đồng.</p><Link className={styles.navyButton} to="/booking/lookup">Tra cứu đặt chỗ <span aria-hidden="true">→</span></Link></div>
    <ol>{[['Thông tin hành khách','Kiểm tra danh sách và thông tin đã gửi.'],['Phòng & gói đã chọn','Xem các lựa chọn đã ghi nhận trong hồ sơ.'],['Hướng dẫn hợp đồng','Xem hướng dẫn hợp đồng trong hồ sơ đặt chỗ.']].map(([title,description],index) => <li key={title}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
  </section>
}
