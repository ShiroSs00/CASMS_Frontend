import type {
  DayDraft,
  Destination,
  HistoryEvent,
  ItinerarySummary,
  Port,
  ShoreExcursion,
  Supplier,
  TourGroup,
} from '../model/itinerary'

export const cruiseOptions = [
  { id: 'cruise-014', code: 'CAS-261214', name: 'Sắc màu Đông Dương', dates: '14–18/12/2026', ship: 'CASMS Aurora' },
  { id: 'cruise-019', code: 'CAS-270108', name: 'Di sản vịnh Bắc Bộ', dates: '08–11/01/2027', ship: 'CASMS Horizon' },
  { id: 'cruise-021', code: 'CAS-270122', name: 'Duyên hải miền Trung', dates: '22–27/01/2027', ship: 'CASMS Aurora' },
  { id: 'cruise-024', code: 'CAS-270205', name: 'Vịnh xanh cuối tuần', dates: '05–07/02/2027', ship: 'Chưa phân công' },
]

export const itineraryFixtures: ItinerarySummary[] = [
  {
    id: 'it-014',
    itineraryName: 'Sắc màu Đông Dương · mùa lễ hội',
    cruiseId: 'cruise-014',
    cruiseCode: 'CAS-261214',
    shipName: 'CASMS Aurora',
    type: 'ROUND_TRIP',
    status: 'PENDING_APPROVAL',
    startDate: '2026-12-14',
    endDate: '2026-12-18',
    daysCount: 5,
    stopsCount: 3,
    owner: 'Nguyễn Hải Yến',
    updatedAt: '2026-10-14T09:42:00+07:00',
    checkPassed: 7,
    checkTotal: 8,
    route: ['Hạ Long', 'Đà Nẵng', 'Chân Mây', 'Hạ Long'],
  },
  {
    id: 'it-019',
    itineraryName: 'Di sản vịnh Bắc Bộ',
    cruiseId: 'cruise-019',
    cruiseCode: 'CAS-270108',
    shipName: 'CASMS Horizon',
    type: 'ROUND_TRIP',
    status: 'APPROVED',
    startDate: '2027-01-08',
    endDate: '2027-01-11',
    daysCount: 4,
    stopsCount: 2,
    owner: 'Trần Minh Đức',
    updatedAt: '2026-10-13T16:18:00+07:00',
    checkPassed: 8,
    checkTotal: 8,
    route: ['Hạ Long', 'Cát Bà', 'Hạ Long'],
  },
  {
    id: 'it-021',
    itineraryName: 'Duyên hải miền Trung',
    cruiseId: 'cruise-021',
    cruiseCode: 'CAS-270122',
    shipName: 'CASMS Aurora',
    type: 'ONE_WAY',
    status: 'DRAFT',
    startDate: '2027-01-22',
    endDate: '2027-01-27',
    daysCount: 6,
    stopsCount: 4,
    owner: 'Lê Bảo An',
    updatedAt: '2026-10-12T14:05:00+07:00',
    checkPassed: 5,
    checkTotal: 8,
    route: ['Hạ Long', 'Huế', 'Đà Nẵng', 'Nha Trang'],
  },
  {
    id: 'it-024',
    itineraryName: 'Vịnh xanh cuối tuần',
    cruiseId: 'cruise-024',
    cruiseCode: 'CAS-270205',
    shipName: 'Chưa phân công',
    type: 'ROUND_TRIP',
    status: 'REJECTED',
    startDate: '2027-02-05',
    endDate: '2027-02-07',
    daysCount: 3,
    stopsCount: 1,
    owner: 'Phạm Hoàng Nam',
    updatedAt: '2026-10-11T10:25:00+07:00',
    checkPassed: 4,
    checkTotal: 8,
    route: ['Hạ Long', 'Cát Bà', 'Hạ Long'],
  },
  {
    id: 'it-009',
    itineraryName: 'Hành trình vịnh di sản',
    cruiseId: 'cruise-009',
    cruiseCode: 'CAS-261105',
    shipName: 'CASMS Horizon',
    type: 'ROUND_TRIP',
    status: 'OPEN_FOR_SALE',
    startDate: '2026-11-05',
    endDate: '2026-11-08',
    daysCount: 4,
    stopsCount: 2,
    owner: 'Nguyễn Hải Yến',
    updatedAt: '2026-10-10T17:10:00+07:00',
    checkPassed: 8,
    checkTotal: 8,
    route: ['Hạ Long', 'Cát Bà', 'Bái Tử Long', 'Hạ Long'],
  },
]

export const defaultSchedule: DayDraft[] = [
  {
    id: 'day-1',
    date: '2026-12-14',
    dayType: 'PORT_DAY',
    description: 'Đón khách và rời cảng Hạ Long',
    stops: [{
      id: 'stop-1',
      portId: 'port-hlg',
      destinationId: 'dest-hlg',
      arrival: '2026-12-14T08:00',
      departure: '2026-12-14T11:30',
      allAboardTime: '2026-12-14T11:00',
      callType: 'NORMAL',
      arrivalMethod: 'BERTH',
    }],
  },
  {
    id: 'day-2',
    date: '2026-12-15',
    dayType: 'SEA_DAY',
    description: 'Di chuyển trên biển · chương trình hoạt động trên tàu',
    stops: [],
  },
  {
    id: 'day-3',
    date: '2026-12-16',
    dayType: 'PORT_DAY',
    description: 'Ghé cảng Chân Mây và tham quan Huế',
    stops: [{
      id: 'stop-2',
      portId: 'port-cmy',
      destinationId: 'dest-hue',
      arrival: '2026-12-16T07:30',
      departure: '2026-12-16T18:00',
      allAboardTime: '2026-12-16T17:15',
      callType: 'NORMAL',
      arrivalMethod: 'BERTH',
    }],
  },
]

export const itineraryHistory: HistoryEvent[] = [
  { id: 'h1', action: 'Gửi duyệt hải trình', description: 'Phiên bản 1.4 được gửi tới Trưởng bộ phận vận hành.', actor: 'Nguyễn Hải Yến', timestamp: '2026-10-14T09:42:00+07:00', tone: 'warning' },
  { id: 'h2', action: 'Điều chỉnh giờ rời cảng', description: 'Chân Mây: 17:30 → 18:00. Lý do: cập nhật slot cảng.', actor: 'Nguyễn Hải Yến', timestamp: '2026-10-14T09:28:00+07:00', tone: 'neutral' },
  { id: 'h3', action: 'Kiểm tra dữ liệu', description: '7/8 tiêu chí đạt. Còn thiếu xác nhận nhà cung cấp tour CM-02.', actor: 'Hệ thống', timestamp: '2026-10-14T09:21:00+07:00', tone: 'neutral' },
  { id: 'h4', action: 'Tạo bản nháp', description: 'Khởi tạo hải trình từ chuyến CAS-261214.', actor: 'Nguyễn Hải Yến', timestamp: '2026-10-10T15:08:00+07:00', tone: 'success' },
]

export const ports: Port[] = [
  { id: 'port-hlg', code: 'VNHLG', name: 'Cảng tàu khách quốc tế Hạ Long', countryCode: 'VN', timeZone: 'Asia/Ho_Chi_Minh', coordinates: '20.9501, 107.0734', status: 'ACTIVE' },
  { id: 'port-cmy', code: 'VNCMA', name: 'Cảng Chân Mây', countryCode: 'VN', timeZone: 'Asia/Ho_Chi_Minh', coordinates: '16.3277, 107.9941', status: 'ACTIVE' },
  { id: 'port-dad', code: 'VNDAD', name: 'Cảng Tiên Sa · Đà Nẵng', countryCode: 'VN', timeZone: 'Asia/Ho_Chi_Minh', coordinates: '16.1198, 108.2140', status: 'ACTIVE' },
  { id: 'port-nha', code: 'VNNHA', name: 'Cảng Nha Trang', countryCode: 'VN', timeZone: 'Asia/Ho_Chi_Minh', coordinates: '12.2084, 109.2142', status: 'ACTIVE' },
]

export const destinations: Destination[] = [
  { id: 'dest-hlg', name: 'Hạ Long', countryCode: 'VN', description: 'Vịnh di sản, trải nghiệm hang động và làng chài.', linkedPorts: 1, status: 'ACTIVE' },
  { id: 'dest-hue', name: 'Cố đô Huế', countryCode: 'VN', description: 'Di sản văn hóa, lăng tẩm và ẩm thực cung đình.', linkedPorts: 1, status: 'ACTIVE' },
  { id: 'dest-dad', name: 'Đà Nẵng · Hội An', countryCode: 'VN', description: 'Biển, phố cổ và hành trình khám phá miền Trung.', linkedPorts: 1, status: 'ACTIVE' },
  { id: 'dest-nha', name: 'Nha Trang', countryCode: 'VN', description: 'Vịnh biển, đảo và trải nghiệm văn hóa Chăm.', linkedPorts: 1, status: 'ACTIVE' },
]

export const suppliers: Supplier[] = [
  { id: 'sup-1', name: 'Heritage Journey Vietnam', type: 'Điều hành tour', contact: 'Trần Hồng Nhung', phone: '090 225 8868', activeTours: 4, status: 'ACTIVE' },
  { id: 'sup-2', name: 'Central Coast Experience', type: 'Vận chuyển & tour', contact: 'Võ Thành Trung', phone: '093 510 2876', activeTours: 3, status: 'ACTIVE' },
  { id: 'sup-3', name: 'Blue Bay Services', type: 'Tender & hậu cần', contact: 'Lâm Minh Khoa', phone: '091 744 2031', activeTours: 1, status: 'ACTIVE' },
]

export const excursions: ShoreExcursion[] = [
  { id: 'ex-1', code: 'CM-01', name: 'Tinh hoa Cố đô Huế', stop: 'Chân Mây · 16/12', supplier: 'Heritage Journey Vietnam', schedule: '08:30–16:30', capacity: 80, booked: 62, price: '1.890.000 ₫', status: 'OPEN' },
  { id: 'ex-2', code: 'CM-02', name: 'Làng cổ & đầm Lập An', stop: 'Chân Mây · 16/12', supplier: 'Central Coast Experience', schedule: '09:00–15:30', capacity: 45, booked: 45, price: '1.350.000 ₫', status: 'FULL' },
  { id: 'ex-3', code: 'DN-04', name: 'Hội An về đêm', stop: 'Tiên Sa · 17/12', supplier: 'Central Coast Experience', schedule: '14:00–21:00', capacity: 72, booked: 38, price: '1.650.000 ₫', status: 'PLANNED' },
]

export const tourGroups: TourGroup[] = [
  { id: 'grp-1', code: 'CM01-A', excursion: 'Tinh hoa Cố đô Huế', guide: 'Mai Phương', vehicle: 'Bus 45 chỗ · 75A-018.24', meetingPoint: 'Sảnh A · Deck 4', capacity: 40, assigned: 38, assemblyTime: '07:45', status: 'PLANNED' },
  { id: 'grp-2', code: 'CM01-B', excursion: 'Tinh hoa Cố đô Huế', guide: 'Hoàng Long', vehicle: 'Bus 45 chỗ · 75A-022.18', meetingPoint: 'Sảnh B · Deck 4', capacity: 40, assigned: 24, assemblyTime: '07:50', status: 'PLANNED' },
  { id: 'grp-3', code: 'CM02-A', excursion: 'Làng cổ & đầm Lập An', guide: 'Thùy Dung', vehicle: 'Bus 29 chỗ · 75B-006.31', meetingPoint: 'Sảnh A · Deck 4', capacity: 28, assigned: 28, assemblyTime: '08:15', status: 'ASSEMBLING' },
]
