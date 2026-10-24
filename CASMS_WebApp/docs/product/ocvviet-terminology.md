# Thuật ngữ OcvViet — phạm vi giao diện quản trị

Nguồn ưu tiên: quyết định trực tiếp của người dùng ngày 2026-10-24; hợp đồng và xử lý BE dùng để đối chiếu dữ liệu/hành động. Bản glossary bootstrap cũ chưa xác nhận không phải quyết định nghiệp vụ. Không thay payload, enum hoặc route để khớp nhãn.

| Khái niệm/field gốc | Ý nghĩa trong dự án | Nhãn tiếng Việt | Mô tả ngắn | Nguồn xác minh | Trạng thái |
|---|---|---|---|---|---|
| Cruise | Chuyến đi cụ thể, ngày giờ/cảng và tàu phân công | Chuyến đi | Chứa lịch trình; không phải thư viện tuyến | Prompt; CruiseCreateRequest, CruiseService | Đã xác minh |
| Itinerary | Nội dung tổ chức theo ngày thuộc một chuyến | Lịch trình | Tuyến tàu và chương trình dùng cùng dữ liệu | Prompt; ItineraryCreateRequest, ItineraryService | Đã xác minh |
| ONE_DAY / MULTI_DAYS | Nhóm thời lượng 1–2 / 3–5 ngày theo quyết định UI | Ngắn ngày / Dài ngày | Không diễn đạt phạm vi quốc gia | Prompt; CruiseCruiseType; BE tự suy luận theo giờ nếu bỏ enum (khác quy tắc UI, FE chọn enum tường minh) | Đã xác minh |
| ItineraryDay.SEA_DAY | Ngày có chương trình trên biển | Ngày trên biển | Không tự biến cảng qua đêm thành ngày biển | Prompt; ItineraryDayType | Đã xác minh |
| ItineraryDay.PORT_DAY | Ngày có lần ghé cảng | Ngày ghé cảng | Nháp có thể cần bổ sung cảng | Prompt; ItineraryDayType | Đã xác minh |
| Port | Bản ghi cảng từ API | Cảng | Không tự đổi thành bến/điểm neo/điểm tham quan | Prompt; Port DTO | Đã xác minh |
| CruiseStop | Một lần tàu ghé một cảng | Lần ghé cảng | Cảng lặp lại có ID lần ghé khác nhau; có thể qua đêm | Prompt; CruiseStop DTO | Đã xác minh |
| Destination | Địa điểm từ danh mục Destination | Điểm đến | Không tự dịch thành cảng hay điểm tham quan cụ thể | Cách gọi hiện có; Destination DTO | Đã xác minh |
| shipTimeZoneId | Giờ dùng trên tàu | Giờ Việt Nam | Asia/Ho_Chi_Minh, không cho người lập thay múi giờ tàu | Prompt | Đã xác minh |
| Port.timeZoneId | Giờ địa phương tại cảng | Giờ địa phương cảng | IANA của cảng, không suy từ quốc gia hoặc máy tính | Prompt; Port DTO | Đã xác minh |
| OnboardActivity | Sự kiện đã gắn chuyến với thời gian/sức chứa | Hoạt động trên tàu | Không gọi là thư viện mẫu dùng chung | ActivityController, ActivityService; prompt | Đã xác minh |
| ShoreExcursion | Chuyến tham quan gắn với lần ghé cảng | Chuyến tham quan trên bờ | Nằm trong khoảng ghé và hạn trở lại | Prompt; ShoreExcursionRequest/Service | Đã xác minh |
| ServicePlanWindow (ý tưởng, chưa có model) | Giờ phục vụ kế hoạch theo ngày | Khung phục vụ | Không đồng nghĩa suất đặt hoặc lịch hẹn | Prompt; kiểm tra ServiceScheduleManagementService | Đã xác minh |
| ServiceSchedule | Lịch dịch vụ đặt chỗ có capacity | Lịch đặt dịch vụ | Không đổi thành khung phục vụ kế hoạch | ServiceScheduleManagementService, controller | Đã xác minh |
| Itinerary.publish / OPEN_FOR_SALE | Phát hành lịch trình đã duyệt | Phát hành lịch trình / Đã phát hành | Không khẳng định mở bán chuyến hoặc booking | Prompt; ItineraryService.publish | Đã xác minh |
| Cruise.publish / PUBLISHED | Chuyển trạng thái chuyến đi | Công bố chuyến đi | Hành động riêng với phát hành lịch trình; không khẳng định tác dụng bán vé ngoài code | CruiseService.publish; cách gọi công bố trong dự án | Đã xác minh |
| effectivePermissions | Quyền hiệu lực của phiên | Quyền truy cập | Permission + điều kiện trạng thái/chủ sở hữu mới quyết định thao tác | AuthController.me; BE guards/services; prompt | Đã xác minh |
| Port vs berth/anchorage/attraction | Chưa có đủ nguồn phân loại chi tiết | Giữ tên từng danh mục hiện có | Không tự gộp hoặc thay tên | Prompt; chưa có mô hình xác nhận bổ sung | Cần xác nhận |
| Tên thương hiệu OcvViet / OceVie | Prompt và asset hiện tại khác cách viết | Giữ asset hiện tại | Cần chủ dự án chốt trước khi thay thương hiệu toàn ứng dụng | Prompt vs BrandLogo/AdminShell hiện có | Cần xác nhận |

Không có yêu cầu tích hợp tính năng AI trong sản phẩm. Không tạo AI draft, seed, trạng thái hoặc permission mới. Đề xuất BE trong tài liệu là đề xuất, không được dùng như API hiện hữu.
