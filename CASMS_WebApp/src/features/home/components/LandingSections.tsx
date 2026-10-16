import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import haLong from '../assets/ha-long.png'
import editorial from '../assets/editorial.png'
import { destinations, featuredVoyages } from '../model/public-booking'
import styles from './Landing.module.css'

export function CruiseFinder() {
  const navigate = useNavigate()
  return <div className={styles.finderWrap}><form className={styles.finder} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); navigate('/cruises?' + new URLSearchParams([...data.entries()].map(([k,v])=>[k,String(v)]))) }}>
    <label>Điểm đến<select name="destination" defaultValue=""><option value="">Hạ Long / Lan Hạ</option><option>Hạ Long</option><option>Lan Hạ</option><option>Cát Bà</option></select></label>
    <label>Cảng khởi hành<select name="port"><option>Tuần Châu</option></select></label>
    <label>Khởi hành<input name="month" type="month" defaultValue="2026-11" /></label>
    <label>Số khách<select name="guests" defaultValue="2">{[1,2,3,4].map(n=><option value={n} key={n}>{n} người lớn</option>)}</select></label>
    <button className={styles.primary}>Tìm chuyến</button>
  </form></div>
}
export function FeaturedVoyages() {
  return <section className={styles.featured} id="voyages"><p className={styles.eyebrow}>HÀNH TRÌNH ĐƯỢC CHỌN</p><h2>Bắt đầu từ một hành trình đáng nhớ.</h2><p className={styles.intro}>So sánh tuyến đi, ngày khởi hành, tàu và giá trước khi chọn hành trình phù hợp.</p><div className={styles.voyageGrid}>{featuredVoyages.map(v=><Link to={'/cruises/'+v.id} className={styles.voyageCard} key={v.id}><img src={v.image} alt={v.title}/><p className={styles.eyebrow}>{v.region}</p><h3>{v.title}</h3><p className={styles.detail}>{v.detail}</p><p className={styles.price}>Từ {v.price} ₫ / khách</p><span>Xem hành trình →</span></Link>)}</div></section>
}
export function DestinationDiscovery() {
  return <section className={styles.destinations} id="destinations"><p className={styles.eyebrow}>ĐIỂM ĐẾN</p><h2>Chọn cảnh quan bạn muốn thức dậy cùng.</h2><div className={styles.destinationGrid}>{destinations.map(d=><Link to={'/cruises?destination='+encodeURIComponent(d.title)} className={styles.destinationCard} key={d.title}><img src={d.image} alt={d.title}/><div className={styles.destinationShade}/><h3>{d.title}</h3><p>{d.detail}</p></Link>)}</div></section>
}
export function AuroraExperience() {
  return <section className={styles.experience} id="experience"><img src={editorial} alt="Boong tàu lúc hoàng hôn"/><div><p className={styles.eyebrow}>TRẢI NGHIỆM AURORA</p><h2>Một chuyến đi không chỉ là lịch trình.</h2><p>Không gian nghỉ, ẩm thực, hoạt động và thời gian riêng được tổ chức thành một trải nghiệm liền mạch trên hành trình.</p><ul><li>Cabin và không gian nghỉ được ưu tiên cho sự thoải mái.</li><li>Trải nghiệm trên tàu gắn với từng nhịp của hành trình.</li><li>Thông tin booking và chuẩn bị trước chuyến luôn rõ ràng.</li></ul><Link className={styles.primary} to="/cruises">Khám phá trải nghiệm</Link></div></section>
}
export function ShipStory() {
  return <section className={styles.ship}><div><p className={styles.eyebrow}>GẶP GỠ ĐỘI TÀU</p><h2>Không gian của hành trình bắt đầu từ con tàu.</h2><p>Khám phá Ocean Voyager qua cabin, khu sinh hoạt chung và những trải nghiệm được tổ chức cho từng ngày trên vịnh.</p><p>Ocean Voyager · Cabin · Ẩm thực · Hoạt động</p><Link className={styles.primary} to="/cruises/ha-long-lan-ha#ship">Xem tàu</Link></div><img src={haLong} alt="Ocean Voyager trên vịnh"/></section>
}
export function BookingJourney() {
  return <section className={styles.journey} id="journey"><p className={styles.eyebrow}>ĐÃ CÓ BOOKING?</p><h2>Chuẩn bị cho chuyến đi, không bỏ sót bước nào.</h2><div className={styles.manage}><div><h3>Theo dõi mọi việc trước ngày khởi hành.</h3><p>Thanh toán, giấy tờ, online check-in và các yêu cầu thay đổi được gom trong một nơi.</p><Link className={styles.primary} to="/my-bookings">Quản lý booking</Link></div><ol>{[['Thông tin khách','Kiểm tra hành khách và giấy tờ.'],['Check-in','Hoàn tất các bước khi đủ điều kiện.'],['Ngày khởi hành','Theo dõi giờ đến cảng và boarding readiness.']].map(([t,d],i)=><li key={t}><span>0{i+1}</span><div>{t}<small>{d}</small></div></li>)}</ol></div></section>
}
export function FinalCta() {
  return <section className={styles.final}><div><p className={styles.eyebrow}>BẮT ĐẦU HÀNH TRÌNH</p><h2>Tìm chuyến phù hợp với nhịp nghỉ của bạn.</h2></div><Link className={styles.primary} to="/cruises">Tìm chuyến</Link></section>
}
export function HomeFooter() {
  const [message,setMessage]=useState('')
  return <footer className={styles.footer} id="help"><div className={styles.footerInner}><div className={styles.footerAbout}><Link to="/" className={styles.brand}>AURORA</Link><p>Hành trình trên vịnh, được kết nối từ lúc khám phá đến ngày khởi hành.</p></div><nav aria-label="Khám phá"><span>KHÁM PHÁ</span><Link to="/cruises">Chuyến du thuyền</Link><a href="#destinations">Điểm đến</a><a href="#experience">Trải nghiệm</a></nav><nav aria-label="Quản lý"><span>QUẢN LÝ</span><Link to="/my-bookings">Booking của tôi</Link><Link to="/login">Đăng nhập</Link></nav><nav aria-label="Hỗ trợ"><span>HỖ TRỢ</span>{['Trợ giúp','Điều khoản sử dụng','Chính sách riêng tư'].map(label=><button key={label} onClick={()=>setMessage('Vui lòng liên hệ bộ phận hỗ trợ AURORA để nhận '+label.toLowerCase()+'.')}>{label}</button>)}</nav><small>AURORA · CASMS WebApp · 2026</small>{message&&<p className={styles.footerNotice} role="status">{message}</p>}</div></footer>
}
