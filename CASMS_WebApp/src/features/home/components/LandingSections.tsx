import { Link, useNavigate, useSearchParams } from 'react-router'
import { asianPorts } from '../model/asian-ports'
const editorial = asianPorts[2].image
import { featuredVoyages, homeCruiseSearch, homeCruiseType } from '../model/public-booking'
import styles from './Landing.module.css'

export function JourneyHighlights() {
  return <section className={styles.highlights} aria-label="Chuẩn bị kỳ nghỉ cùng OceVie">{[
    ['01', 'Tìm nhịp nghỉ của bạn', 'Khám phá chuyến ngắn ngày hoặc hành trình dài hơn.'],
    ['02', 'Chọn không gian riêng', 'Xem phòng còn trống cho từng hành khách trong nhóm.'],
    ['03', 'Sẵn sàng trước ngày đi', 'Tra cứu hồ sơ và hướng dẫn hợp đồng bằng mã đặt chỗ.'],
  ].map(([number,title,description])=><div key={number}><span aria-hidden="true">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>)}</section>
}

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
  return <section className={styles.featured} id="voyages" aria-labelledby="voyages-title"><div className={styles.sectionLead}><div><p className={styles.eyebrow}>NHẬT KÝ TỪ BIỂN</p><h2 id="voyages-title">Một góc nhìn khác.<br />Một kỳ nghỉ khác.</h2></div><p className={styles.intro}>Những khung hình từ thành phố cảng châu Á, dành cho khi bạn cần một chút cảm hứng trước chuyến đi.</p></div><div className={styles.voyageGrid}>{featuredVoyages.map((v,index)=><article className={styles.voyageCard} key={v.id}><div className={styles.voyageImage}><img src={v.image} alt={`${v.title}`} loading="lazy" width="1600" height="1000"/><span>0{index+1} / CẢM HỨNG</span></div><p className={styles.eyebrow}>{v.region}</p><h3>{v.title}</h3><p className={styles.detail}>{v.detail}</p></article>)}</div><Link className={styles.textLink} to="/cruises">Từ cảm hứng đến hành trình — xem chuyến đã công bố ↗</Link></section>
}
export { DestinationDiscovery } from './PublicDestinations'
export function OceVieExperience() {
  return <section className={styles.experience} id="experience" aria-labelledby="experience-title"><img src={editorial} alt="Cảng Ōsanbashi, Yokohama lúc hoàng hôn"/><div><p className={styles.eyebrow}>CHUẨN BỊ TRẢI NGHIỆM</p><h2 id="experience-title">Từng lựa chọn, theo nhịp nghỉ của bạn.</h2><p>Xem lịch trình, chọn phòng cho từng hành khách và cân nhắc gói dịch vụ tùy chọn trước khi gửi yêu cầu.</p><ul><li>Phòng trống được hiển thị theo hành trình.</li><li>Gói dịch vụ có thể bỏ qua khi đặt chỗ.</li><li>Kiểm tra và sửa thông tin trước khi gửi.</li></ul><Link className={styles.primary} to="/cruises">Tìm hành trình & chọn phòng</Link></div></section>
}
export function ShipStory() {
  return <section className={styles.ship} aria-labelledby="ship-title">
    <div>
      <p className={styles.eyebrow}>TÀU & KHÔNG GIAN</p>
      <h2 id="ship-title">Tìm hiểu con tàu của từng hành trình.</h2>
      <p>Khám phá không gian trên tàu, lịch trình và những điểm dừng trong từng chuyến đi.</p>
      <p className={styles.detail}>Ảnh cảng Yokohama, Nhật Bản.</p>
      <Link className={styles.primary} to="/ships">Khám phá tàu & không gian</Link>
    </div>
    <img src="/images/ports/yokohama-osanbashi.webp" alt="Tàu du lịch và nhà ga hành khách quốc tế Ōsanbashi tại cảng Yokohama, Nhật Bản"/>
  </section>
}
export function BookingJourney() {
  return <section className={styles.journey} id="journey" aria-labelledby="journey-title"><p className={styles.eyebrow}>ĐÃ CÓ MÃ ĐẶT CHỖ?</p><h2 id="journey-title">Chuẩn bị cho chuyến đi, không bỏ sót bước nào.</h2><div className={styles.manage}><div><h3>Theo dõi thông tin trước ngày khởi hành.</h3><p>Xem mã đặt chỗ, hành khách, phòng và hướng dẫn hợp đồng. Dùng mã đặt chỗ cùng email hoặc số điện thoại đại diện để tra cứu, không cần đăng nhập.</p><Link className={styles.primary} to="/booking/lookup">Tra cứu đặt chỗ</Link></div><ol>{[['Thông tin đặt chỗ','Kiểm tra mã đặt chỗ và danh sách hành khách.'],['Phòng & gói','Xem phòng và gói đã ghi nhận.'],['Hợp đồng','Đọc hướng dẫn ký và lịch yêu cầu thanh toán.']].map(([t,d],i)=><li key={t}><span>0{i+1}</span><div>{t}<small>{d}</small></div></li>)}</ol></div></section>
}
export function FinalCta() {
  return <section className={styles.final}><div><p className={styles.eyebrow}>BẮT ĐẦU HÀNH TRÌNH</p><h2>Tìm chuyến phù hợp với nhịp nghỉ của bạn.</h2></div><Link className={styles.primary} to="/cruises">Tìm chuyến</Link></section>
}

export function BookingFaq() {
  return <section className={styles.faq} id="booking-faq" aria-labelledby="booking-faq-title">
    <div>
      <p className={styles.eyebrow}>TRƯỚC KHI BẠN ĐẶT CHỖ</p>
      <h2 id="booking-faq-title">Thông tin cần biết<br />trước khi đặt chuyến.</h2>
      <Link className={styles.faqButton} to="/cruises">
        <span>Tìm hành trình phù hợp</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
    <div>{[
      ['Tôi có cần đăng nhập để đặt chuyến?', 'Bạn có thể xem hành trình đã công bố, chọn phòng và gửi thông tin đặt chỗ mà không cần tài khoản. Sau khi có mã, dùng thông tin người đại diện để tra cứu.'],
      ['Tôi xem giá vé và lịch thanh toán ở đâu?', 'Thông tin giá vé, tiền tệ áp dụng và lịch thanh toán nằm trong kết quả đặt chỗ. Giá gói và giá tham chiếu của phòng được hiển thị riêng khi có dữ liệu; chúng không phải tổng giá vé đã xác nhận.'],
      ['Làm sao để xem lại thông tin đã đặt?', 'Mở trang tra cứu, nhập mã đặt chỗ cùng email hoặc số điện thoại của người đại diện. Bạn có thể xem thông tin hành khách, phòng và hướng dẫn hợp đồng được hệ thống trả về.'],
    ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
  </section>
}
