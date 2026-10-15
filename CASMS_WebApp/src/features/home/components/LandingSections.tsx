import { useState } from 'react'
import { Link } from 'react-router'
import haLong from '../assets/ha-long.png'
import lanHa from '../assets/lan-ha.png'
import editorial from '../assets/editorial.png'
import { pendingBookingMessage } from '../model/public-booking'
import styles from './Landing.module.css'

const voyages = [
  { title: 'Hạ Long — Lan Hạ', detail: 'Ocean Voyager · 3 ngày 2 đêm', price: '4.800.000', image: haLong },
  { title: 'Cát Bà — Lan Hạ', detail: 'Aurora Dawn · 4 ngày 3 đêm', price: '6.200.000', image: lanHa },
  { title: 'Hạ Long Signature', detail: 'Ocean Voyager · 2 ngày 1 đêm', price: '3.900.000', image: editorial },
]
const destinations = [
  { title: 'Hạ Long', detail: 'Đảo đá vôi · vịnh mở', image: haLong },
  { title: 'Lan Hạ', detail: 'Vùng nước yên · kayak', image: lanHa },
  { title: 'Cát Bà', detail: 'Đảo xanh · nhịp nghỉ chậm', image: editorial },
]
const steps = [
  ['Chọn hành trình', 'Tìm ngày khởi hành và hành trình phù hợp.'],
  ['Chọn cabin', 'So sánh không gian, tầm nhìn và gói trải nghiệm.'],
  ['Hoàn tất booking', 'Kiểm tra người đi, điều khoản và trạng thái booking.'],
  ['Chuẩn bị trước chuyến', 'Theo dõi thanh toán, giấy tờ và check-in khi khả dụng.'],
]

export function CruiseFinder() {
  const [message, setMessage] = useState('')
  return <div className={styles.finderWrap}><form className={styles.finder} onSubmit={(event) => { event.preventDefault(); setMessage(pendingBookingMessage('find-voyage')) }}>
    <label>Điểm đến<select defaultValue="bay"><option value="bay">Hạ Long / Lan Hạ</option><option>Hạ Long</option><option>Lan Hạ</option><option>Cát Bà</option></select></label>
    <label>Khởi hành<input aria-label="Khởi hành" defaultValue="Tháng 11, 2026" /></label>
    <label>Số khách<select defaultValue="2"><option value="1">1 người lớn</option><option value="2">2 người lớn</option><option value="3">3 người lớn</option><option value="4">4 người lớn</option></select></label>
    <label>Thời lượng<select defaultValue="3–5 ngày"><option>3–5 ngày</option><option>2 ngày 1 đêm</option><option>3 ngày 2 đêm</option></select></label>
    <button className={styles.primary} type="submit">Tìm hành trình</button>
  </form>{message && <p className={styles.notice} role="status">{message}</p>}</div>
}

export function FeaturedVoyages() {
  return <section className={styles.featured} id="voyages"><p className={styles.eyebrow}>HÀNH TRÌNH NỔI BẬT</p><h2>Bắt đầu từ một hành trình đáng nhớ.</h2><p className={styles.intro}>Ba gợi ý để bạn hình dung nhịp đi, không gian nghỉ và trải nghiệm trên tàu trước khi chọn ngày khởi hành.</p><div className={styles.voyageGrid}>{voyages.map((voyage) => <article className={styles.voyageCard} key={voyage.title}><img src={voyage.image} alt={`Cảnh quan ${voyage.title}`} /><p className={styles.eyebrow}>SIGNATURE SAILING</p><h3>{voyage.title}</h3><p className={styles.detail}>{voyage.detail}</p><p className={styles.price}>Từ {voyage.price} ₫ / khách</p></article>)}</div></section>
}

export function DestinationDiscovery() {
  return <section className={styles.destinations} id="destinations"><p className={styles.eyebrow}>ĐIỂM ĐẾN</p><h2>Chọn cảnh quan bạn muốn thức dậy cùng.</h2><div className={styles.destinationGrid}>{destinations.map((destination) => <article className={styles.destinationCard} key={destination.title}><img src={destination.image} alt={`Vịnh ${destination.title}`} /><div className={styles.destinationShade} /><h3>{destination.title}</h3><p>{destination.detail}</p></article>)}</div></section>
}

export function AuroraExperience() {
  return <section className={styles.experience} id="experience"><img src={editorial} alt="Trải nghiệm nghỉ dưỡng trên vịnh AURORA" /><div><p className={styles.eyebrow}>KHÁM PHÁ THEO CÁCH CỦA BẠN</p><h2>Một chuyến đi không chỉ là lịch trình.</h2><p>Cabin, ẩm thực, hoạt động và thời gian nghỉ được kết nối thành một trải nghiệm xuyên suốt.</p><a className={styles.primary} href="#journey">Khám phá trải nghiệm</a></div></section>
}

export function BookingJourney() {
  return <section className={styles.journey} id="journey"><p className={styles.eyebrow}>TỪ Ý ĐỊNH ĐẾN NGÀY KHỞI HÀNH</p><h2>Một hành trình rõ ràng từ lúc chọn chuyến.</h2><div className={styles.stepGrid}>{steps.map(([title, description], index) => <article key={title}><p className={styles.eyebrow}>0{index + 1}</p><h3>{title}</h3><p>{description}</p></article>)}</div></section>
}

export function HomeFooter() {
  const [message, setMessage] = useState('')
  return <footer className={styles.footer} id="help"><div className={styles.footerInner}><div className={styles.footerAbout}><Link to="/" className={styles.brand}>AURORA</Link><p>Hành trình trên vịnh, được kết nối từ lúc khám phá đến ngày khởi hành.</p></div><nav aria-label="Khám phá"><span>KHÁM PHÁ</span><a href="#voyages">Chuyến du thuyền</a><a href="#destinations">Điểm đến</a><a href="#experience">Trải nghiệm</a></nav><nav aria-label="Quản lý"><span>QUẢN LÝ</span><button onClick={() => setMessage(pendingBookingMessage('my-bookings'))}>Booking của tôi</button><Link to="/login">Đăng nhập</Link><button onClick={() => setMessage('Vui lòng liên hệ quản trị viên hoặc bộ phận hỗ trợ AURORA để được trợ giúp.')}>Trợ giúp</button></nav><small>AURORA · CASMS WebApp · 2026</small>{message && <p className={styles.footerNotice} role="status">{message}</p>}</div></footer>
}
