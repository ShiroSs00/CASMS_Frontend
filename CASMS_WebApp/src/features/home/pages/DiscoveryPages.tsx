import { Link } from 'react-router'
import { BookingFaq, DestinationDiscovery, FinalCta, ShipStory } from '../components/LandingSections'
import { asianPorts } from '../model/asian-ports'
import landing from '../components/Landing.module.css'
import styles from './DiscoveryPages.module.css'

const discoveryCopy = {
  destinations: { label: 'Điểm đến', eyebrow: 'CẢM HỨNG TỪ CHÂU Á', title: 'Những bến cảng. Những khởi đầu mới.', description: 'Tìm cảm hứng từ những thành phố bên biển, rồi khám phá các hành trình đã công bố để lên kế hoạch cho kỳ nghỉ của bạn.', action: 'Xem hành trình đã công bố', photo: 0 },
  ships: { label: 'Tàu', eyebrow: 'KHÔNG GIAN TRÊN BIỂN', title: 'Kỳ nghỉ bắt đầu từ con tàu.', description: 'Khám phá thông tin tàu theo từng hành trình. Chọn chuyến để tìm hiểu con tàu, lịch trình và phòng còn trống cho kỳ nghỉ của bạn.', action: 'Xem chuyến & thông tin tàu', photo: 2 },
  deals: { label: 'Deals', eyebrow: 'LÊN KẾ HOẠCH KỲ NGHỈ', title: 'Tìm hành trình hợp với bạn.', description: 'Khám phá các hành trình đã công bố và cân nhắc lựa chọn phù hợp với thời gian nghỉ của bạn.', action: 'Khám phá các chuyến', photo: 0 },
}

function DiscoveryHeading({ kind }: { kind: keyof typeof discoveryCopy }) {
  const copy = discoveryCopy[kind]
  const photo = asianPorts[copy.photo]
  return <header className={styles.heading}>
    <div className={styles.copy}>
      <nav aria-label="Đường dẫn trang"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{copy.label}</span></nav>
      <p className={styles.eyebrow}>OCEVIE · {copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <Link className={styles.action} to="/cruises">{copy.action} <span aria-hidden="true">↗</span></Link>
    </div>
    <figure><img src={photo.image} alt={photo.alt} width="1600" height="1000" fetchPriority="high" style={{ objectPosition: photo.position }} /><figcaption>Ảnh cảm hứng · {photo.location} · {photo.country}</figcaption></figure>
  </header>
}

export function DestinationsPage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Điểm đến châu Á | OceVie</title>
    <DiscoveryHeading kind="destinations" />
    <div className={`${landing.container} ${styles.content}`}><DestinationDiscovery /><FinalCta /></div>
  </div>
}

export function ShipsPage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Tàu & không gian trên biển | OceVie</title>
    <DiscoveryHeading kind="ships" />
    <div className={`${landing.container} ${styles.content}`}><ShipStory /><BookingFaq /><FinalCta /></div>
  </div>
}

export function DealsPage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Deals & lựa chọn hành trình | OceVie</title>
    <DiscoveryHeading kind="deals" />
    <div className={`${landing.container} ${styles.content}`}>
      <section className={styles.offerNotice} aria-labelledby="offers-title"><p className={styles.eyebrow}>ƯU ĐÃI OCEVIE</p><h2 id="offers-title">Đón chờ ưu đãi cho chuyến đi tiếp theo.</h2><p>Ưu đãi sẽ được giới thiệu tại đây khi có thông tin xác nhận. Hiện bạn có thể khám phá hành trình theo thời gian nghỉ; các lựa chọn bên dưới không phải chương trình giảm giá.</p></section>
      <section className={styles.tripChoices} aria-label="Khám phá theo loại hành trình">
        <Link to="/cruises?cruiseType=ONE_DAY"><span>01 · KỲ NGHỈ NGẮN</span><h2>Đổi gió trong ít ngày.</h2><p>Khám phá chuyến ngắn ngày (1–2 ngày).</p><strong>Xem hành trình <span aria-hidden="true">↗</span></strong></Link>
        <Link to="/cruises?cruiseType=MULTI_DAYS"><span>02 · THÊM THỜI GIAN KHÁM PHÁ</span><h2>Chậm lại, đi xa hơn.</h2><p>Khám phá chuyến dài ngày (3–5 ngày).</p><strong>Xem hành trình <span aria-hidden="true">↗</span></strong></Link>
      </section><FinalCta />
    </div>
  </div>
}
