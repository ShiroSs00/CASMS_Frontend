import { Link } from 'react-router'
import { AdminShell } from '@/shared/ui/admin-v3'
import styles from './AdminWorkflowPage.module.css'

const steps = [
  {
    title: 'Điểm đến & cảng',
    purpose: 'Xác định những nơi chuyến đi có thể ghé và các cảng phục vụ hành trình.',
    prerequisite: 'Danh sách điểm đến, quốc gia và thông tin cảng dự kiến sử dụng.',
    links: [{ label: 'Điểm đến', to: '/admin/destinations' }, { label: 'Cảng', to: '/admin/ports' }],
    next: 'Chuẩn bị tàu và sức chứa phù hợp với tuyến đi.',
  },
  {
    title: 'Tàu, boong & cabin',
    purpose: 'Quản lý phương tiện, cấu trúc boong và cabin phục vụ hành khách.',
    prerequisite: 'Thông tin tàu; tạo boong thuộc tàu trước khi bố trí cabin.',
    links: [{ label: 'Tàu', to: '/admin/ships' }, { label: 'Boong', to: '/admin/decks' }, { label: 'Cabin', to: '/admin/cabins' }],
    next: 'Chọn tàu để lập kế hoạch chuyến du lịch.',
  },
  {
    title: 'Bản nháp chuyến du lịch',
    purpose: 'Lập kế hoạch ngày khởi hành, ngày trở về và tàu được phân công.',
    prerequisite: 'Tàu đã được cấu hình và khoảng thời gian dự kiến của chuyến đi.',
    links: [{ label: 'Danh sách chuyến', to: '/admin/cruises' }, { label: 'Tạo chuyến', to: '/admin/cruises/new' }],
    next: 'Tạo hải trình gắn với đúng chuyến du lịch.',
  },
  {
    title: 'Hải trình',
    purpose: 'Gắn kế hoạch tuyến đi với một chuyến du lịch cụ thể.',
    prerequisite: 'Chuyến du lịch đã tồn tại và các điểm đến, cảng dự kiến.',
    links: [{ label: 'Hải trình', to: '/admin/itineraries' }, { label: 'Tạo hải trình', to: '/admin/itineraries/new' }],
    next: 'Mở chi tiết hải trình để sắp xếp từng ngày và điểm dừng.',
  },
  {
    title: 'Ngày hành trình & điểm dừng',
    purpose: 'Chi tiết hóa lịch từng ngày, thứ tự ghé cảng và thời gian dừng.',
    prerequisite: 'Hải trình của chuyến và các cảng liên quan đã có sẵn.',
    links: [{ label: 'Chọn hải trình để xem chi tiết', to: '/admin/itineraries' }],
    next: 'Kiểm tra lịch trình, điều kiện vận hành và quy định áp dụng.',
  },
  {
    title: 'Kiểm tra điều kiện & mức độ sẵn sàng',
    purpose: 'Rà soát các điều kiện cần thiết và quy định trước khi công bố chuyến.',
    prerequisite: 'Tàu, chuyến, lịch trình chi tiết và các quy định liên quan.',
    links: [{ label: 'Tàu', to: '/admin/ships' }, { label: 'Chuyến du lịch', to: '/admin/cruises' }, { label: 'Quy định', to: '/admin/regulations' }],
    next: 'Xử lý các điều kiện còn thiếu theo kết quả kiểm tra trên màn hình chi tiết.',
  },
  {
    title: 'Công bố chuyến du lịch',
    purpose: 'Chỉ công bố khi hệ thống cho phép và tài khoản có quyền thực hiện.',
    prerequisite: 'Các điều kiện bắt buộc đã được kiểm tra tại chi tiết chuyến.',
    links: [{ label: 'Chọn chuyến để kiểm tra và công bố', to: '/admin/cruises' }],
    next: 'Theo dõi chuyến và phối hợp xử lý các sự cố vận hành.',
  },
  {
    title: 'Sự cố vận hành',
    purpose: 'Theo dõi vấn đề phát sinh và phối hợp xử lý trong quá trình vận hành.',
    prerequisite: 'Xác định đúng chuyến, tàu và thông tin liên quan đến sự cố.',
    links: [{ label: 'Sự cố vận hành', to: '/admin/issues' }],
    next: 'Phối hợp với các bên cung cấp dịch vụ liên quan khi cần.',
  },
  {
    title: 'Nhà cung cấp, tham quan bờ & nhóm tour',
    purpose: 'Chuẩn bị và điều phối các dịch vụ bờ gắn với chuyến đi.',
    prerequisite: 'Nhà cung cấp, kế hoạch tham quan và quan hệ với chuyến phù hợp.',
    links: [{ label: 'Nhà cung cấp', to: '/admin/suppliers' }, { label: 'Tham quan bờ', to: '/admin/shore-excursions' }, { label: 'Nhóm tour', to: '/admin/tour-groups' }],
    next: 'Tiếp tục phối hợp dịch vụ và theo dõi vấn đề tại các màn hình nghiệp vụ.',
  },
]

export function AdminWorkflowPage() {
  return <AdminShell>
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>HƯỚNG DẪN QUẢN TRỊ</p>
        <h1>Quy trình chuẩn bị & vận hành chuyến đi</h1>
        <p>Từ dữ liệu nền tảng đến điều phối chuyến du lịch, mở đúng công cụ cho từng bước công việc.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} to="/admin/destinations">Bắt đầu từ điểm đến</Link>
          <Link to="/admin/cruises">Mở danh sách chuyến</Link>
        </div>
      </header>
      <p className={styles.note}>Đây là hướng dẫn trình tự công việc. Trạng thái thực tế, kết quả kiểm tra và quyền thao tác được hiển thị tại từng màn hình nghiệp vụ.</p>
      <nav className={styles.actions} aria-label="Công cụ dịch vụ trên tàu"><Link to="/admin/bookings">Đặt chỗ & hợp đồng</Link><Link to="/admin/package-assignments">Gói của hành khách</Link><Link to="/admin/activity-registrations">Đăng ký & điểm danh</Link><Link to="/admin/activities">Hoạt động trên tàu</Link><Link to="/admin/services">Dịch vụ</Link><Link to="/admin/products">Sản phẩm</Link><Link to="/admin/service-packages">Gói & quyền lợi</Link><Link to="/admin/service-requests">Yêu cầu dịch vụ</Link></nav>
      <ol className={styles.steps}>
        {steps.map((step, index) => <li key={step.title} className={styles.step}>
          <div className={styles.stepHeading}><span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2>{step.title}</h2></div>
          <p>{step.purpose}</p>
          <dl><dt>Cần chuẩn bị</dt><dd>{step.prerequisite}</dd><dt>Bước tiếp theo</dt><dd>{step.next}</dd></dl>
          <div className={styles.links}>{step.links.map(link => <Link key={link.to} to={link.to}>{link.label}<span aria-hidden="true"> →</span></Link>)}</div>
        </li>)}
      </ol>
    </div>
  </AdminShell>
}
