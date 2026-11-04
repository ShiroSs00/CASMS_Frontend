import type { Violation } from './plan'
import { violationTarget } from './violation-target'

const copy: Record<string, string> = {
  EMPTY_SCHEDULE: 'Thêm nội dung cho lịch trình trước khi chốt mẫu.',
  INVALID_DAY_COUNT: 'Số ngày trong lịch trình không khớp thời lượng chuyến đi.',
  INVALID_DAY_SEQUENCE: 'Kiểm tra thứ tự các ngày trong lịch trình.',
  INVALID_DURATION: 'Kiểm tra thời lượng chuyến đi.',
  TRIP_TYPE_MISMATCH: 'Loại chuyến đi không khớp số ngày của lịch trình.',
  DAY_TYPE_REQUIRED: 'Chọn loại ngày trong lịch trình.',
  DEPARTURE_PORT_REQUIRED: 'Chọn cảng khởi hành cho ngày 1.',
  DEPARTURE_TIME_REQUIRED: 'Nhập giờ khởi hành dự kiến.',
  END_DAY_REQUIRES_PORT: 'Thêm lần ghé cảng vào ngày cuối.',
  PORT_DAY_REQUIRES_PORT_CALL: 'Ngày xuống bờ cần có lần ghé cảng.',
  SEA_DAY_FORBIDS_PORT_CALL: 'Ngày trên biển không thể có lần ghé cảng.',
  MISSING_EMBARKATION: 'Chọn cảng hành khách lên tàu.',
  MISSING_DISEMBARKATION: 'Chọn cảng hành khách kết thúc chuyến.',
  EMBARKATION_MUST_BE_DAY_1: 'Cảng hành khách lên tàu phải ở ngày 1.',
  DISEMBARKATION_MUST_BE_LAST_DAY: 'Cảng hành khách kết thúc chuyến phải ở ngày cuối.',
  PORT_CALL_TIME_REQUIRED: 'Nhập đủ giờ tàu đến và rời cảng.',
  INVALID_PORT_CALL_TIMES: 'Ngày và giờ tàu rời phải sau lúc tàu đến.',
  INVALID_STOP_DAY_INTERVAL: 'Kiểm tra ngày đến và ngày rời của lần ghé.',
  INVALID_STOP_SEQUENCE_TIME: 'Thứ tự ghé cảng chưa khớp với ngày và giờ.',
  NON_POSITIVE_TRANSIT_TIME: 'Chừa thời gian di chuyển giữa hai cảng.',
  PORT_CALL_OVERLAP: 'Thời gian hai lần ghé cảng bị chồng nhau.',
  PORT_OUTSIDE_COUNTRY_SCOPE: 'Chọn cảng thuộc quốc gia đã cấu hình cho chuyến.',
  PORT_OUTSIDE_DOMESTIC_REGION: 'Chọn cảng thuộc miền đã cấu hình cho chuyến.',
  PORT_OUTSIDE_PLANNED_SCOPE: 'Chọn cảng phù hợp với phạm vi chuyến đi.',
  INVALID_ALL_ABOARD_TIME: 'Hạn trở lại tàu phải nằm trong khoảng ghé cảng.',
  ALL_ABOARD_REQUIRED_FOR_EXCURSION: 'Nhập hạn trở lại tàu cho lần ghé có tour.',
  INVALID_ENTRY_DAY_INTERVAL: 'Kiểm tra ngày bắt đầu và ngày kết thúc của mục chương trình.',
  INVALID_ENTRY_TIME: 'Giờ kết thúc phải sau giờ bắt đầu.',
  INVALID_ONBOARD_TIME: 'Kiểm tra giờ bắt đầu và kết thúc hoạt động trên tàu.',
  INVALID_EXCURSION_TIME: 'Kiểm tra giờ bắt đầu và kết thúc tour trên bờ.',
  MEETING_POINT_REQUIRED: 'Bổ sung điểm tập trung cho mục chương trình.',
  SHORE_REQUIRES_STOP: 'Gắn tour với một lần ghé cảng.',
  SHORE_BEFORE_ARRIVAL: 'Dời giờ bắt đầu tour đến sau khi tàu đến cảng.',
  SHORE_AFTER_DEPARTURE: 'Điều chỉnh giờ kết thúc tour trong thời gian ghé cảng và hạn trở lại tàu.',
  SHORE_EXCURSION_PORT_MISMATCH: 'Chọn tour phù hợp với cảng của lần ghé.',
  SOURCE_ACTIVITY_INACTIVE: 'Chọn hoạt động nguồn còn sử dụng.',
  SOURCE_ACTIVITY_NOT_FOUND: 'Chọn lại hoạt động nguồn trong danh mục.',
  SOURCE_EXCURSION_INACTIVE: 'Chọn tour nguồn còn sử dụng.',
  SOURCE_EXCURSION_NOT_FOUND: 'Chọn lại tour nguồn trong danh mục.',
}

export function planningViolationMessage(row: Violation) {
  if (row.code === 'PORT_CALL_TIME_REQUIRED') {
    if (row.fieldPath?.endsWith('.plannedArrivalTime') || row.field === 'plannedArrivalTime') return 'Nhập giờ tàu đến.'
    if (row.fieldPath?.endsWith('.plannedDepartureTime') || row.field === 'plannedDepartureTime') return 'Nhập giờ tàu rời.'
  }
  return copy[row.code] ?? `Kiểm tra nội dung được đánh dấu (mã ${row.code}).`
}

export function mergePlanningViolations(server: Violation[], client: Violation[]) {
  const unique = new Map<string, Violation>()
  for (const row of [...server, ...client]) {
    const target = violationTarget(row)
    const field = target.fieldId ?? row.field ?? row.fieldPath ?? ''
    const key = JSON.stringify([row.code, row.severity, target.kind, target.key ?? target.dayNumber, field])
    if (!unique.has(key)) unique.set(key, row)
  }
  return [...unique.values()]
}
