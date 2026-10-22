import { Link, useNavigate, useSearchParams } from 'react-router'
import { asianPorts } from '../model/asian-ports'
const haLong = asianPorts[0].image
const editorial = asianPorts[2].image
import { destinations, featuredVoyages, homeCruiseSearch, homeCruiseType } from '../model/public-booking'
import styles from './Landing.module.css'

export function CruiseFinder() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const cruiseType = homeCruiseType(params.get('cruiseType'))
  return <section className={styles.finderWrap} id="cruise-finder" aria-labelledby="finder-title"><div className={styles.finderHeading}><h2 id="finder-title">Tìm chuyến du thuyền</h2><p id="finder-help">Chọn loại hành trình; xem ngày khởi hành và phòng trống ở từng chuyến.</p></div><form className={styles.finder} onSubmit={event => { event.preventDefault(); navigate(homeCruiseSearch(cruiseType)) }}>
    <label><span id="home-cruise-type-label">Loại hành trình</span><select aria-labelledby="home-cruise-type-label" aria-describedby="finder-help" name="cruiseType" value={cruiseType} onChange={event => { const query = new URLSearchParams(params); if (event.target.value) query.set('cruiseType', event.target.value); else query.delete('cruiseType'); setParams(query, { replace: true, preventScrollReset: true }) }}><option value="">Tất cả hành trình</option><option value="ONE_DAY">Chuyến ngắn ngày (1–2 ngày)</option><option value="MULTI_DAYS">Chuyến dài ngày (3–5 ngày)</option></select></label>
    <button type="submit" className={styles.primary}>Tìm chuyến</button><Link className={styles.textLink} to="/booking/lookup">Đã có mã? Tra cứu đặt chỗ</Link>
  </form></section>
}
export function FeaturedVoyages() {
  return <section className={styles.featured} id="voyages" aria-labelledby="voyages-title"><p className={styles.eyebrow}>CẢM HỨNG HẢI TRÌNH</p><h2 id="voyages-title">Những bến cảng khơi nguồn cảm hứng.</h2><p className={styles.intro}>Khám phá những thành phố cảng và tìm hành trình cho kỳ nghỉ tiếp theo.</p><div className={styles.voyageGrid}>{featuredVoyages.map(v=><article className={styles.voyageCard} key={v.id}><img src={v.image} alt={`${v.title}`}/><p className={styles.eyebrow}>{v.region}</p><h3>{v.title}</h3><p className={styles.detail}>{v.detail}</p></article>)}</div><Link className={styles.textLink} to="/cruises">Xem các chuyến đã công bố →</Link></section>
}
export function DestinationDiscovery() {
  return <section className={styles.destinations} id="destinations" aria-labelledby="destinations-title"><p className={styles.eyebrow}>GỢI Ý ĐIỂM ĐẾN</p><h2 id="destinations-title">Ghé châu Á qua từng bến cảng.</h2><p className={styles.intro}>Từ Đông Nam Á đến Đông Bắc Á, mỗi bến cảng mở ra một góc nhìn mới.</p><div className={styles.destinationGrid}>{destinations.map(d=><article className={styles.destinationCard} key={d.title}><img src={d.image} alt={`Ảnh cảng châu Á · ${d.title}`}/><div className={styles.destinationShade}/><div className={styles.destinationCopy}><h3>{d.title}</h3><p>{d.detail}</p></div></article>)}</div><Link className={styles.textLink} to="/cruises">Xem tất cả hành trình →</Link></section>
}
export function OceVieExperience() {
  return <section className={styles.experience} id="experience" aria-labelledby="experience-title"><img src={editorial} alt="Cảng Ōsanbashi, Yokohama lúc hoàng hôn"/><div><p className={styles.eyebrow}>CHUẨN BỊ TRẢI NGHIỆM</p><h2 id="experience-title">Từng lựa chọn, theo nhịp nghỉ của bạn.</h2><p>Xem lịch trình, chọn phòng cho từng hành khách và cân nhắc gói dịch vụ tùy chọn trước khi gửi yêu cầu.</p><ul><li>Phòng trống được hiển thị theo hành trình.</li><li>Gói dịch vụ có thể bỏ qua khi đặt chỗ.</li><li>Kiểm tra và sửa thông tin trước khi gửi.</li></ul><Link className={styles.primary} to="/cruises">Tìm hành trình & chọn phòng</Link></div></section>
}
export function ShipStory() {
  return <section className={styles.ship} aria-labelledby="ship-title"><div><p className={styles.eyebrow}>TÀU & KHÔNG GIAN</p><h2 id="ship-title">Tìm hiểu con tàu của từng hành trình.</h2><p>Khám phá không gian trên tàu, lịch trình và những điểm dừng trong từng chuyến đi.</p><p className={styles.detail}>Ảnh cảng Marina Bay, Singapore.</p><Link className={styles.primary} to="/cruises">Xem chuyến & thông tin tàu</Link></div><img src={haLong} alt="Cảng Marina Bay, Singapore; không xác định tàu của chuyến đi"/></section>
}
export function BookingJourney() {
  return <section className={styles.journey} id="journey" aria-labelledby="journey-title"><p className={styles.eyebrow}>ĐÃ CÓ MÃ ĐẶT CHỖ?</p><h2 id="journey-title">Chuẩn bị cho chuyến đi, không bỏ sót bước nào.</h2><div className={styles.manage}><div><h3>Theo dõi thông tin trước ngày khởi hành.</h3><p>Xem mã đặt chỗ, hành khách, phòng và hướng dẫn hợp đồng. Dùng mã đặt chỗ cùng email hoặc số điện thoại đại diện để tra cứu, không cần đăng nhập.</p><Link className={styles.primary} to="/booking/lookup">Tra cứu đặt chỗ</Link></div><ol>{[['Thông tin đặt chỗ','Kiểm tra mã đặt chỗ và danh sách hành khách.'],['Phòng & gói','Xem phòng và gói đã ghi nhận.'],['Hợp đồng','Đọc hướng dẫn ký và lịch yêu cầu thanh toán.']].map(([t,d],i)=><li key={t}><span>0{i+1}</span><div>{t}<small>{d}</small></div></li>)}</ol></div></section>
}
export function FinalCta() {
  return <section className={styles.final}><div><p className={styles.eyebrow}>BẮT ĐẦU HÀNH TRÌNH</p><h2>Tìm chuyến phù hợp với nhịp nghỉ của bạn.</h2></div><Link className={styles.primary} to="/cruises">Tìm chuyến</Link></section>
}
