# CASMS Mobile Phase C — SERVICE_CATALOG

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc: ServicesRoute, features/services/PassengerServicesScreen, PassengerServiceRequestsScreen, PassengerActionUI, PassengerUI/Scaffold/Button, OceVie Mobile, ServicepackageController và ServiceCatalogReadService. File sửa: PassengerServiceRequestsScreen, passenger-api/types; thêm ServiceDetail, onboard-contracts/context/errors.

Root cause: API catalogue/detail cung cấp thêm category/unit/purchase-stage fields nhưng màn hiện hành không có detail GET và category filter. Catalogue toàn cục không gắn ship; không có projection Passenger cho assignment/operating hours trong availability. Sau thay đổi, search và category dùng field categoryId/categoryName thật; không hardcode loại dịch vụ hoặc ảnh demo. ServiceDetail dùng GET riêng và so UUID, hiển thị mô tả, category, price/currency/unit, capacity cấu hình, slot đúng cruise, location và port. Tách thông báo global capacity khỏi khả năng dùng trong chuyến.

API: GET services/detail/availability/schedules, BOOKING_READ entitlement. Availability quantity khớp input; slots remainingCapacity do BE trả, không trừ local. Giờ theo timeZoneId; thiếu zone hiển thị UTC kèm offset, không tùy tiện dùng giờ thiết bị. Full slot hiện ở detail, picker chỉ nhận slot còn đủ chỗ/chưa kết thúc. Trước create refetch detail và slots; nếu giá/currency/điều kiện đổi thì yêu cầu xem lại.

UI dùng skeleton tĩnh theo token, empty/search-no-result/error/retry/offline guidance, Pull-to-refresh. Detail sheet và request sheet tái dùng primitive. Chưa có bằng chứng catalogue lớn để chọn paging hay virtualization; BE-12 và QA volume vẫn mở, không tạo endpoint paging giả. Backend không có area/deck projection trên ServiceView nên không dựng địa điểm giả; hiển thị location theo schedule khi có.

Test evidence: search/category/empty/inactive, unknown price, currency khác, ID/quantity mismatch, malformed/over-precision price, zero/full/corrupt slots. Source state và scope verified; rendered responsive/keyboard/device còn BLOCKED_BY_ENVIRONMENT. Dependency maintenance tách backlog FE. Acceptance global read/detail FE sẵn sàng; ship-scoped availability projection BE-15 OPEN.
