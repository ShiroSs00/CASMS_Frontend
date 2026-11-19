# CASMS Booking Agent — BE/FE contract

Ngày: 2026-11-19 (Asia/Saigon). FE base: `main@703c239`; BE tham chiếu chỉ đọc: `main@0cc292e`. Đã fetch cả hai repo trước khi sửa; FE mới hơn SHA `9f064da` trong brief. Báo cáo lập trước commit; xuất bản sau kiểm chứng theo yêu cầu riêng của người dùng. Chỉ sửa source Frontend; không sửa source, migration, schema hoặc business rules BE.

## API thực tế

Tất cả path dưới `/api`; production FE gọi qua shared `apiRequest`, JWT/session hiện có. Không tạo endpoint BE mới.

| Endpoint | Request | Response / permission / constraint |
|---|---|---|
| GET /booking | page, size=20, status?, cruiseId? | Spring Page: content/totalElements/totalPages/number. BOOKING_READ. Agent scope CruiseStaff ACTIVE, không phải creator-only. |
| GET /booking/{id} | UUID | BookingDetailResponse; BOOKING_READ + validateAccess, requireAssignedCruise khi scoped Agent. |
| GET /booking/lookup | reference + email? + phoneNumber?; ít nhất một liên hệ | Full detail; public/contact-based, không có principal/CruiseStaff guard. Lookup read-only trên FE, không tự cấp action. 400/403/404 khác nhau. |
| GET /cruise | page,size,status=PUBLISHED | Scoped Agent luôn đi vào listOpenForSale với assignee, kể cả khi có quyền read khác không thuộc exception role. Không đủ để dựng lịch sử. |
| GET /cruise/{id}/sellability | UUID | cruiseId, sellable, blockers theo BE; Agent phải được phân công. Không thay việc BE kiểm tra lại khi quote/create. |
| GET /booking/available-cabins | cruiseId; deckId?, cabinType?, minCapacity? | cabinId/number/deck/type/capacity/remainingCapacity/accessibility. Principal Agent phải assigned. Controller hiện không nhận bookingPassengerId. |
| GET /cruise/{id}/cruise-package-offers/available | UUID | fareManaged/offers với selection, offer/price revision, logical category/mapping. Giữ decoder và các ràng buộc package hiện tại. |
| GET /cruise/{id}/packages; GET /servicepackage/packages | UUID | Gói legacy phải gắn đúng chuyến, ACTIVE, đúng currency. Không tự chuyển thành fare package. |
| POST /booking/quotes | cruiseId,currency,paymentPlan,passenger cabin/package/fare selection | Quote có quoteId, policyVersion, fingerprint, expiresAt, currency,totalAmount,lineItems. Service requireAssignedCruise. Readback và so selection trước create. |
| GET /booking/quotes/{id} | JWT hoặc guest proof theo BE | Quote owner + Agent assignment, expiry và content matching. Không dùng giá FE làm giá chính thức. |
| POST /booking | Idempotency-Key; cruiseId,currency,paymentPlan,notes?,passengers,quoteId | Detail. Staff key có thể optional theo controller nhưng FE luôn gửi. Quote/capacity/sellability/price revision/assignment do BE kiểm tra. |
| GET /booking/recovery | idempotencyKey; JWT của actor hoặc guest proof theo BE | Detail. Key riêng không cấp quyền. 404 NOT_FOUND hoặc 409 IN_PROGRESS không cho tự POST mới. FE Agent dùng JWT, chỉ GET. |
| POST /booking/{id}/contract/accept | documentReference (1..255); acceptedByBookingPassengerId?, acceptedAt?; notes phải null | BOOKING_CONTRACT_MANAGE; bản ký gắn đúng booking; trả contract Accepted. FE chỉ gửi documentReference. |
| POST /booking/{id}/confirm | không body | BOOKING_CONFIRM; Draft, contract Accepted, verified collected payments đủ cọc, currency/evidence/refunds/capacity/sale lifecycle đều do BE. |
| POST /booking/{id}/cancel | reason bắt buộc | BOOKING_CANCEL; nếu workflow bật, trả 409 CANCELLATION_CASE_REQUIRED. FE không chuyển qua direct cancel để né case. |
| GET/POST /booking/{id}/cancellations | POST scenario,reason,issueId? + Idempotency-Key | Case history/request theo workflow hiện có; Agent không tự quyết định refund/approval. Các transition theo allowedActions và quyền BE. |
| POST /booking/change-cabin | bookingPassengerId,newCabinId,changeReason?,assignWholeGroup? | BOOKING_CABIN_ASSIGN hoặc BOOKING_UPDATE. validateAccess + cabin cùng tàu/còn chỗ/status. BE hiện chặn mọi fareOfferId bằng FARE_CABIN_CHANGE_NOT_SUPPORTED trước khi group assignment. |

## DTO

Detail decode giữ booking/cruise/status/passenger identity, fare package captured selection và purchased snapshot. Kiểm tra amount hữu hạn không âm, ISO currency, paymentPlan/status enum và installment validity. Bổ sung optional shipName/cruiseCode, contractDocumentReference/contractAcceptedAt, totalPaidAmount/outstandingBalance; không gán zero khi thiếu.

Passenger response có name, birth/nationality/contact, cabin, service package/fare, participation state. Số giấy tờ protected không mang sang view model/render. Không dùng fallback giả cho dữ liệu thiếu.

## Phạm vi và phân quyền

Nguồn: BookingController, BookingService.detail/list/createQuote/createBooking/acceptContract/confirm/cancel/changeCabin/recovery; BookingRepository; BookingAgentCruiseScope; CruiseController.list/detail/packages/sellability; CruiseStaffService; RolePermissionInitializer; DTO request/response tại BE HEAD nêu trên.

BookingAgentCruiseScope chỉ scope role BOOKING_AGENT khi không kèm role quản lý cruise nằm trong exception set của BE. Assignment match userId + cruise + roleInCruise BOOKING_AGENT + status ACTIVE. FE không tự đếm assignment từ catalogue mở bán, không suy đoán phân công từ lookup.

Không chỉnh role initializer, work-policy, shared API permission map hoặc mở ADMIN toàn cục. Account switch được bảo vệ bằng client generation/abort, keyed Outlet/BookingProvider, recovery namespace theo user.

## Handoff cần BE/product

- Endpoint distinct các chuyến lịch sử có scope để tối ưu filter và contract phân biệt chưa phân công/chưa có booking, nếu sản phẩm cần.
- Quy tắc đổi/phân cabin fare/group chưa được hỗ trợ bởi endpoint hiện tại; không hứa pass feature này bằng UI.
- Review privacy của public lookup và full detail payload. Contact match không đồng nghĩa nội bộ assigned; FE không thể thay BE authorization.
- Chuẩn bị chuyến PUBLISHED, ACTIVE Booking Agent assignments, package/price/sale/commercial terms và booking hợp lệ để nghiệm thu thành công toàn giao dịch. Không thay trực tiếp trạng thái hoặc khoản thu làm bằng chứng giả.
- Không sửa migration/checksum. BE launcher đã validate schema trên DB casms: 128 migrations được Flyway validate, schema up-to-date, max successful version 137.
