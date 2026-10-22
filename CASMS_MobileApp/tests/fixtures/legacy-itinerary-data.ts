export const demoVoyage = {
  name: 'Sắc màu eo biển Malacca',
  route: 'Singapore — Port Klang — Penang — Phuket',
  countries: 'Singapore · Malaysia · Thái Lan',
  dates: '18–21/10/2026',
  currentDay: 1,
} as const;

/** Fictional Asian-port itinerary; times are UI fixtures, not an operating schedule. */
/** Fictional Passenger fixtures. No mutation, approval or staff actions are exposed. */
export const scenarios = [
  ['normal', 'Bình thường'], ['changed', 'Đổi giờ tour'], ['empty', 'Chưa có tour'],
  ['tour-cancelled', 'Tour bị hủy'], ['started', 'Đang tham quan'], ['returned', 'Đã quay về'],
  ['substitute', 'Đổi điểm dừng'], ['sea', 'Ngày trên biển'], ['cancelled', 'Hủy hải trình'],
  ['offline', 'Ngoại tuyến'], ['loading', 'Đang tải'], ['error', 'Lỗi tải lịch'],
] as const;
export type ItineraryScenario = typeof scenarios[number][0];
export type TourStatus = 'confirmed' | 'started' | 'completed' | 'cancelled';
export type Excursion = {
  title: string; meeting: string; meetingTime: string; departure: string; returnTime: string;
  group: string | null; guide: string | null; passengers: number | null; status: TourStatus;
};
export type ItineraryDay = {
  date: number; country: string; timeZoneId: string; destination: string; port: string; arrival: string; departure: string;
  allAboard: string | null; actualArrival: string | null; sea: boolean; tour: Excursion | null;
};
export type ChangeNotice = { title: string; published: string; applies: string; description: string };
export const tourStatusLabels: Record<TourStatus, string> = {
  confirmed: 'Đã xác nhận', started: 'Đang tham quan', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
};
const tour: Excursion = { title: 'Khám phá Kuala Lumpur', meeting: 'Sảnh chính · Tầng 1', meetingTime: '09:40', departure: '10:00', returnTime: '13:30', group: 'G03', guide: 'Minh Anh', passengers: 12, status: 'confirmed' };
const days: ItineraryDay[] = [
  { date: 18, country: 'Singapore', timeZoneId: 'Asia/Singapore', destination: 'Singapore', port: 'Marina Bay Cruise Centre Singapore', arrival: '12:00', departure: '15:00', allAboard: '14:30', actualArrival: null, sea: false, tour: { ...tour, title: 'Khám phá tàu Ocean OceVie', meetingTime: '12:00', departure: '12:30', returnTime: '14:00', group: null, guide: null, passengers: null } },
  { date: 19, country: 'Malaysia', timeZoneId: 'Asia/Kuala_Lumpur', destination: 'Port Klang', port: 'Port Klang', arrival: '09:00', departure: '17:00', allAboard: '16:30', actualArrival: '09:05', sea: false, tour },
  { date: 20, country: 'Malaysia', timeZoneId: 'Asia/Kuala_Lumpur', destination: 'Penang', port: 'Swettenham Pier Cruise Terminal', arrival: '08:00', departure: '16:00', allAboard: '15:30', actualArrival: null, sea: false, tour: { ...tour, title: 'Dạo bước George Town', meetingTime: '08:40', departure: '09:00', returnTime: '12:00' } },
  { date: 21, country: 'Thái Lan', timeZoneId: 'Asia/Bangkok', destination: 'Phuket', port: 'Cảng Phuket', arrival: '08:00', departure: '10:00', allAboard: null, actualArrival: null, sea: false, tour: null },
];
export function getItineraryDay(index: number, scenario: ItineraryScenario = 'normal'): ItineraryDay {
  const base = days[index] ?? days[1];
  const result = { ...base, tour: base.tour ? { ...base.tour } : null };
  // Operational scenarios affect only the second day, never rewrite every day's times.
  if (index !== 1) return result;
  if (scenario === 'sea') return { ...result, destination: 'Ngày trên biển', port: '', sea: true, tour: null, allAboard: null, actualArrival: null };
  if (scenario === 'empty') result.tour = null;
  if (scenario === 'substitute') { result.destination = 'Melaka'; result.port = 'Điểm đón trả khách Melaka (minh họa)'; result.actualArrival = null; if (result.tour) result.tour.title = 'Khám phá di sản Melaka'; }
  if (result.tour) {
    if (scenario === 'changed') { result.tour.meetingTime = '10:10'; result.tour.departure = '10:30'; }
    if (scenario === 'tour-cancelled') result.tour.status = 'cancelled';
    if (scenario === 'started') result.tour.status = 'started';
    if (scenario === 'returned') result.tour.status = 'completed';
  }
  return result;
}
export function getChanges(scenario: ItineraryScenario): ChangeNotice[] {
  const published = { title: 'Công bố hải trình 4 ngày 3 đêm', published: '17/10/2026 · 18:00 · UTC+8', applies: '18–21/10/2026', description: 'Hành trình minh họa Singapore — Port Klang — Penang — Phuket. Không phải lịch khai thác hoặc xác nhận đặt chỗ.' };
  const descriptions: Partial<Record<ItineraryScenario, [string, string]>> = {
    changed: ['Điều chỉnh giờ tour Kuala Lumpur', 'Tập trung 09:40 → 10:10. Khởi hành 10:00 → 10:30. Quay về dự kiến 13:30. Do điều kiện khai thác tại điểm dừng.'],
    substitute: ['Thay Port Klang bằng Melaka', 'Điểm dừng minh họa chuyển sang Melaka, tour thay bằng Khám phá di sản Melaka. Giờ đến 09:00, hạn lên tàu 16:30, rời bến 17:00.'],
    'tour-cancelled': ['Tour Kuala Lumpur đã hủy', 'Hủy tour do điều kiện thời tiết. Các mốc giờ tàu vẫn áp dụng. Vui lòng liên hệ quầy dịch vụ để được hỗ trợ.'],
    sea: ['Chuyển sang ngày trên biển', 'Ngày 19/10 không ghé cảng và không tổ chức tour bờ. Tàu tiếp tục hành trình trên biển.'],
    cancelled: ['Hủy hải trình', 'Hải trình không tiếp tục theo lịch đã công bố. Vui lòng liên hệ quầy dịch vụ trên tàu để được hỗ trợ.'],
  };
  const change = descriptions[scenario];
  return change ? [{ title: change[0], description: change[1], published: '19/10/2026 · 09:10 · UTC+8', applies: '19/10/2026' }, published] : [published];
}
export function stopDuration(arrival: string, departure: string) {
  const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const total = (minutes(departure) - minutes(arrival) + 1440) % 1440;
  return `${Math.floor(total / 60)} giờ${total % 60 ? ` ${total % 60} phút` : ''}`;
}
