import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BookingFaq, DestinationDiscovery, FinalCta, ShipStory } from '../components/LandingSections'
import { asianPorts } from '../model/asian-ports'
import landing from '../components/Landing.module.css'
import styles from './DiscoveryPages.module.css'

const discoveryCopy = {
  destinations: {
    label: 'Điểm đến',
    eyebrow: 'CẢM HỨNG TỪ CHÂU Á',
    title: 'Những bến cảng. Những khởi đầu mới.',
    description: 'Tìm cảm hứng từ những thành phố bên biển, rồi khám phá các hành trình đã công bố để lên kế hoạch cho kỳ nghỉ của bạn.',
    action: 'Xem hành trình đã công bố',
    photo: 0,
    target: '/cruises',
  },
  ships: {
    label: 'Tàu & Không gian',
    eyebrow: 'KHÔNG GIAN TRÊN BIỂN',
    title: 'Kỳ nghỉ bắt đầu từ con tàu.',
    description: 'Khám phá thông tin tàu theo từng hành trình. Chọn chuyến để tìm hiểu con tàu, lịch trình và phòng còn trống cho kỳ nghỉ của bạn.',
    action: 'Xem chuyến & thông tin tàu',
    photo: 2,
    target: '/cruises',
  },
  deals: {
    label: 'Ưu đãi',
    eyebrow: 'CHƯƠNG TRÌNH ƯU ĐÃI & HẢI TRÌNH',
    title: 'Ưu đãi hành trình dành riêng cho bạn.',
    description: 'Khám phá các gói kỳ nghỉ ngắn ngày và dài ngày với mức giá ưu đãi tốt nhất, dịch vụ tiện nghi và nhiều quyền lợi hấp dẫn.',
    action: 'Xem các gói ưu đãi',
    photo: 1, // Hong Kong Victoria - completely different from cruises hero
    target: '#offers',
  },
}

function DiscoveryHeading({ kind }: { kind: keyof typeof discoveryCopy }) {
  const copy = discoveryCopy[kind]
  const photo = asianPorts[copy.photo]
  const isHash = copy.target?.startsWith('#')

  return <header className={styles.heading}>
    <div className={styles.copy}>
      <nav aria-label="Đường dẫn trang"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{copy.label}</span></nav>
      <p className={styles.eyebrow}>OCEVIE · {copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      {isHash ? (
        <a className={styles.action} href={copy.target}>{copy.action} <span aria-hidden="true">↓</span></a>
      ) : (
        <Link className={styles.action} to={copy.target}>{copy.action} <span aria-hidden="true">↗</span></Link>
      )}
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

export function ShipsPage({ explorer }: { explorer?: ReactNode }) {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Tàu & không gian trên biển | OceVie</title>
    <DiscoveryHeading kind="ships" />
    <div className={`${landing.container} ${styles.content}`}>{explorer}<ShipStory /><BookingFaq /><FinalCta /></div>
  </div>
}

export function DealsPage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Ưu đãi và lựa chọn hành trình | OceVie</title>
    <DiscoveryHeading kind="deals" />
    <div className={`${landing.container} ${styles.content}`}>
      <section className={styles.offerNotice} id="offers" aria-labelledby="offers-title">
        <p className={styles.eyebrow}>ƯU ĐÃI OCEVIE</p>
        <h2 id="offers-title">Các gói hành trình ưu đãi hấp dẫn</h2>
        <p>Chọn các gói chuyến du thuyền ngắn ngày hoặc dài ngày đã được tối ưu chi phí và trải nghiệm. Đặt sớm để nhận thêm các ưu đãi dịch vụ đi kèm trên tàu.</p>
      </section>
      <section className={styles.tripChoices} aria-label="Khám phá theo loại hành trình ưu đãi">
        <Link to="/cruises?cruiseType=ONE_DAY">
          <span>01 · ƯU ĐÃI CHUYẾN NGẮN NGÀY</span>
          <h2>Đổi gió cuối tuần (1–2 ngày)</h2>
          <p>Hành trình nghỉ dưỡng ngắn ngày linh hoạt với dịch vụ phòng và ẩm thực trọn gói.</p>
          <strong>Xem các chuyến ngắn ngày <span aria-hidden="true">↗</span></strong>
        </Link>
        <Link to="/cruises?cruiseType=MULTI_DAYS">
          <span>02 · ƯU ĐÃI CHUYẾN DÀI NGÀY</span>
          <h2>Hải trình trọn vẹn (3–5 ngày)</h2>
          <p>Thêm thời gian khám phá các thành phố cảng châu Á với mức giá ưu đãi đặt sớm.</p>
          <strong>Xem các chuyến dài ngày <span aria-hidden="true">↗</span></strong>
        </Link>
      </section>
      <FinalCta />
    </div>
  </div>
}
