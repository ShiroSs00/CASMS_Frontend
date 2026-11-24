# Passenger Voyage Context

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đọc `PassengerItineraryService`, `PassengerItineraryResponse`, BookingDetail/Summary, Cruise/Itinerary/Day/Stop DTO, RolePermissionInitializer, User/Passenger và các enum. Sửa `passenger-api.ts`, `passenger-hooks.ts`, `passenger-model.ts`, `passenger-types.ts`, `voyage-selection.ts`, `itinerary-api.ts`, `itinerary-client.ts`, cache itinerary và Notifications.

| Dữ liệu | API và kiểm tra |
|---|---|
| Owner và hồ sơ Passenger | GET `/auth/me`, UUID, ACTIVE, role thuần Passenger, quyền thực theo response. Không dùng fallback từ roles khi grants thiếu. |
| Booking / BookingPassenger | GET `/itineraries/mine` là danh sách theo actor, GET `/booking` phân trang đầy đủ, GET `/booking/{id}` đối chiếu exact booking/cruise/bookingPassenger. So với passengerId từ Me khi có. |
| Cruise / Ship / cabin | GET `/cruise/{id}` xác minh UUID/trạng thái/thời gian; ship nullable, phòng/tầng dựa trên Booking Detail. Không tạo phòng hoặc tên tàu mặc định. |
| Itinerary | ID có thể vắng trong /mine. GET `/itineraries/{id}`, days, stops giữ phạm vi cruise đã chọn; validate ngày, enum, UUID và timestamp của scoped contract. |
| Registration | Upcoming activity từ `registeredActivities` của đúng BookingPassenger. Home chỉ tóm tắt đăng ký đã xác nhận, sắp diễn ra. |

**Trước → sau.** Trước xếp hạng rồi rơi về hàng đầu, kể cả khi cùng ưu tiên hoặc cùng booking nhiều hồ sơ. Nay giữ cặp hợp lệ đã chọn, tự dùng ứng viên duy nhất có mức ưu tiên cao nhất theo thứ tự có sẵn, và yêu cầu chọn khi đồng hạng. Native khôi phục đúng cặp theo backend/owner/login epoch và kiểm lại với dữ liệu server. Cặp cũ mất hiệu lực không tự đổi. Query keys chứa URL, owner, epoch, entity ID và cruise/itinerary tương ứng. Signed-out dọn cache/draft/selection.

| Trạng thái quan sát | Trải nghiệm FE |
|---|---|
| Không có booking hoặc chưa có chuyến | Phân biệt qua kết quả đọc /booking và /mine. Hướng về booking hoặc hỗ trợ. |
| Booking / participation bị hủy | Không là ứng viên thao tác; giải thích khi dữ liệu /mine xác nhận trạng thái. |
| PUBLISHED / IN_PROGRESS | Badge có chữ. Hành động phụ thuộc grant và context; Backend quyết định lifecycle. |
| COMPLETED / CANCELLED cruise | Cho xem lại nếu projection vẫn có; Home/Account ẩn shortcut vận hành. |
| Cabin chưa gán / itinerary chưa tạo | Hiển thị trạng thái thiếu dữ liệu đúng trường nullable và phân biệt lỗi query. |
| Check-in / OnboardAccount | Các trục riêng. BoardingReady không suy ra đã lên tàu. Folio/OnboardAccount còn ngoài phạm vi A-FE. |

**Acceptance:** test nhiều/single/empty/cancel, scope khác, missing cabin/itinerary, DTO lỗi và timezone pass. Expo Data Fetching dùng query/cache hiện có. Bộ dữ liệu nhiều booking thật chờ QA. [Database handoff](../mobile-phase-a0-fe/CASMS_DATABASE_HANDOFF.md).
