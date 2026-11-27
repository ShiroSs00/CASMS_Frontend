import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BookingFaq, DestinationDiscovery, FinalCta } from '../components/LandingSections'
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
    label: 'Tàu',
    eyebrow: 'ĐỘI TÀU OCEVIE',
    title: 'Đồng hành cùng OceVie',
    description: 'Tàu được phân công cho từng chuyến khởi hành. Chọn chuyến đã công bố để xem tàu được gán, lịch trình và Cabin còn khả dụng.',
    action: 'Xem chuyến & thông tin tàu',
    photo: 2,
    target: '/cruises',
  },
  deals: {
    label: 'Lựa chọn hành trình',
    eyebrow: 'HẢI TRÌNH & GÓI DU THUYỀN',
    title: 'Chọn nhịp hành trình phù hợp cho kỳ nghỉ của bạn.',
    description: 'Khám phá các hải trình trong ngày và nhiều ngày đang mở đặt chỗ cùng các gói du thuyền và dịch vụ đi kèm trên tàu.',
    action: 'Xem các loại hành trình',
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
    <figure><img src={photo.image} alt={photo.alt} width="1600" height="1000" fetchPriority="high" style={{ objectPosition: photo.position }} /><figcaption>Ảnh cảm hứng · {photo.location === photo.country ? photo.location : `${photo.location} · ${photo.country}`}</figcaption></figure>
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
    <title>Tàu | OceVie</title>
    <DiscoveryHeading kind="ships" />
    <div className={`${landing.container} ${styles.content}`}>{explorer}<BookingFaq /><FinalCta /></div>
  </div>
}

export function DealsPage() {
  return <div className={`${landing.home} ${styles.page}`}>
    <title>Lựa chọn hành trình | OceVie</title>
    <DiscoveryHeading kind="deals" />
    <div className={`${landing.container} ${styles.content}`}>
      <section className={styles.offerNotice} id="offers" aria-labelledby="offers-title">
        <p className={styles.eyebrow}>HẢI TRÌNH OCEVIE</p>
        <h2 id="offers-title">Lựa chọn hành trình theo thời lượng</h2>
        <p>Chọn hành trình trong ngày hoặc nhiều ngày đang mở đặt chỗ. Giá gói du thuyền, thuế và phí cảng được hiển thị minh bạch ở từng chuyến trước khi bạn xác nhận đặt chỗ.</p>
      </section>
      <section className={styles.tripChoices} aria-label="Khám phá theo loại hành trình">
        <Link to="/cruises?cruiseType=ONE_DAY">
          <span>01 · HẢI TRÌNH TRONG NGÀY</span>
          <h2>Trải nghiệm du thuyền trong ngày</h2>
          <p>Hành trình nghỉ dưỡng gọn nhẹ trong ngày với ẩm thực và tiện ích chọn lọc trên vịnh.</p>
          <strong>Xem các chuyến trong ngày <span aria-hidden="true">↗</span></strong>
        </Link>
        <Link to="/cruises?cruiseType=MULTI_DAYS">
          <span>02 · HẢI TRÌNH NHIỀU NGÀY</span>
          <h2>Hải trình nghỉ dưỡng nhiều ngày</h2>
          <p>Thêm thời gian khám phá các thành phố cảng châu Á cùng lịch trình đa điểm dừng và lựa chọn gói dịch vụ phù hợp.</p>
          <strong>Xem các chuyến nhiều ngày <span aria-hidden="true">↗</span></strong>
        </Link>
      </section>
      <FinalCta />
    </div>
  </div>
}
