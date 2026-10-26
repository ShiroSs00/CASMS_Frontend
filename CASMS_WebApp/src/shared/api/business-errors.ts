const messages:Readonly<Record<string,string>>={
  VERSION_NOT_PUBLISHED:'Phiên bản lịch trình nguồn chưa ở trạng thái đã phát hành. Mở lại đúng phiên bản được phép sử dụng.',
  IDEMPOTENCY_CONFLICT:'Chưa đối chiếu được mã thao tác với yêu cầu trước. Giữ nguyên bản nhập và mã thao tác; không tạo yêu cầu mới.',
  SCOPE_COUNTRY_REQUIRED:'Chuyến đi chưa có phạm vi quốc gia hợp lệ. Cập nhật phạm vi trước khi chọn cảng.',
  PORT_OUTSIDE_COUNTRY_SCOPE:'Cảng đã chọn nằm ngoài các quốc gia của chuyến đi.',
  PORT_OUTSIDE_DOMESTIC_REGION:'Cảng đã chọn nằm ngoài các miền của chuyến đi.',
  EXISTING_STOPS_OUTSIDE_NEW_SCOPE:'Các lần ghé cảng đã lưu chưa phù hợp với phạm vi mới. Hãy xử lý trước khi đổi phạm vi.',
  PORT_COUNTRY_SCOPE_VIOLATION:'Cảng của lần ghé nằm ngoài phạm vi quốc gia của lần khởi hành.',
  PORT_CALL_OVERLAP:'Thời gian lưu cảng của các lần ghé bị chồng nhau.',
  NON_POSITIVE_TRANSIT_TIME:'Hai cảng khác nhau phải có thời gian di chuyển lớn hơn 0 giữa giờ rời cảng trước và giờ đến cảng sau.',
  INVALID_STOP_SEQUENCE_TIME:'Thứ tự các lần ghé cảng không khớp trình tự thời gian.',
  INVALID_PORT_CALL_TIMES:'Ngày giờ dự kiến đến và rời của lần ghé cảng chưa hợp lệ.',
  SHORE_EXCURSION_OUTSIDE_PORT_WINDOW:'Tour tham quan trên bờ vượt giờ đến, giờ rời hoặc hạn trở lại tàu của lần ghé.',
  EXCURSION_OUTSIDE_PORT_WINDOW:'Tour tham quan đang liên kết không nằm trong khoảng thời gian ghé cảng mới.',
}

/** Keep distinct BE codes and Vietnamese record-specific details intact. */
export function businessErrorMessage(code:string|undefined,message:string):string {
  const translated=code?messages[code]:undefined
  if(!translated)return message
  if(message&&/[\u00c0-\u024f\u1e00-\u1eff]/u.test(message))return message
  return translated
}
