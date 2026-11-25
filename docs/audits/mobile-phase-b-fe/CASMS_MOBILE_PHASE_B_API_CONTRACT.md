# CASMS Mobile Phase B — API_CONTRACT

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đọc trực tiếp `CASMS_Backend/src/main/java/com/casms/checkin/{controller/CheckinController.java,service/CheckinService.java,dto/CheckinResponse.java,enums/CheckinStepCode.java,enums/CruiseCheckinStatus.java}`, `pos/{PassengerCardController.java,PassengerCardService.java,PosAccessService.java,PosController.java}`, `identity/service/RolePermissionInitializer.java`, migration V138 và toàn bộ `ios/PassengerCardPOS`.

Tất cả endpoint dưới đây nằm sau base URL `/api`. `{id}` là **BookingPassenger UUID**, không phải Passenger/User ID.

| Method / endpoint | Request / response / authority |
|---|---|
| GET /checkin/passenger/{id}/status | CHECKIN_READ + owner; CheckinResponse |
| POST /checkin/passenger/{id}/start | CHECKIN_CREATE + owner; query emergencyContactName/Phone optional khi start; CheckinResponse |
| POST /checkin/passenger/{id}/complete | CHECKIN_UPDATE + owner; không body; CheckinResponse BoardingReady |
| POST /checkin/passenger/{id}/card-claim | PASSENGER + CHECKIN_READ + owner; không body; code/expiresAt |
| POST /pos/passenger-cards/preview | code; bookingPassengerId/passengerName |
| POST /pos/passenger-cards/confirm | code/cardIdentifier; bookingPassengerId/passengerName/confirmedAt |
| POST /pos/passenger-cards/lookup | cardIdentifier; bookingPassengerId/passengerName/confirmedAt |

POS ba route đều yêu cầu employee JWT, principal enabled/nonlocked, POS_ACCESS + CHECKIN_BOARDING và X-POS-Session đúng employee/terminal/area/cruise. Không suy quyền từ SERVICE_SALE, không sử dụng device credential thay employee JWT.

Service check-in online start/complete trong ba giờ trước departure đến departure. Complete cần Confirmed booking, Active participation, hợp đồng Accepted, contact name/phone không trống. CheckinStatus: NotStarted/InProgress/NeedsReview/Completed/BoardingReady; StepCode Identity/Document/EmergencyContact/PaymentEligibility. BoardingReady không phải gangway aboard.

Claim cần Confirmed/Active/BoardingReady và chưa có assignment. Server sinh 32 byte base64url 43 ký tự, TTL hiện tại 10 phút. FE lấy expiresAt, không gắn cố định 600 giây. Renew upsert hash mới, thay mã cũ và reset consumed. PASSENGER_CARD_ALREADY_ASSIGNED (409) là evidence từ server của assignment; chưa có projection GET Passenger.

Preview/confirm kiểm cruise/claim hết hạn hoặc consumed. PASSENGER_CARD_CLAIM_INVALID (404) gộp invalid/expired/consumed; FE không tự phân biệt nguyên nhân. PASSENGER_CARD_CHECKIN_REQUIRED (409), INVALID_NFC_CARD_IDENTIFIER (400), assignment conflict (409) giữ nguyên server authority. Confirm consume+assign trong transaction. UID hex 4–32 byte, canonical uppercase; unique (cruise_id, card_identifier) theo V138. Lookup kiểm Confirmed/Active trong cruise POS. Đọc UID không phải chứng minh mật mã hoặc cho phép giao dịch.

Zod validate UUID/timestamp/nullable trường hiển thị, schema response và scope comparison. API contract STATIC_VERIFIED; chưa đối chiếu deployment QA.
