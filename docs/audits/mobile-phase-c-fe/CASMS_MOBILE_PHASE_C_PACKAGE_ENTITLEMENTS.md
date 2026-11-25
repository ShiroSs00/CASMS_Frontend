# CASMS Mobile Phase C — PACKAGE_ENTITLEMENTS

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc: PassengerPackagesScreen cũ, ServicepackageController/ServicepackageService/TourPackage/BookingPassengerPackage, BookingController/Service, CruisePackageEntitlementService và snapshot binding DTO/entity. File sửa: PassengerPackagesScreen, passenger-api, Account/Booking entry points; thêm EntitlementSummary và schemas.

Root cause: màn cũ chọn draft và có POST/PUT/DELETE package assignment, không phải màn quyền lợi đã mua. Phase C yêu cầu giữ đọc khi business chưa chốt. Nay màn chỉ dùng BOOKING_READ, confirmed Voyage Context; GET /booking/{id}/cruise-package-entitlements và lọc đúng BP. Link Account đã đổi từ TOUR_PACKAGE_ASSIGN sang quyền đọc, Booking draft không còn CTA viết package; ghi NEED_BUSINESS_DECISION. Adapter legacy save/change/remove còn để bảo toàn contract/test cũ nhưng không có production UI gọi ở màn này.

Hiển thị benefitName/sourcePackageName/inclusion, grantedQuantity/usedQuantity/remainingQuantity, units, usage window, canRegister và blockers. Không tự trừ quota, không lấy package presence làm còn quota, null/missing normalized unknown khác 0. OPTIONAL/NOT_INCLUDED không nói đã mua thêm. ACTIVE không đồng nghĩa đủ chỗ; canRegister và blockers đọc server, capacity vẫn kiểm riêng. Không dùng allowance, budget hoặc số dư tiền mặt.

Liên kết quyền lợi service/activity/excursion bằng exact occurrence resourceType/resourceId + BP. Projection thiếu occurrence mapping thì chỉ hiển thị grant riêng, không ghép tên. Legacy TourPackage component/category benefits không có used/remaining purchased projection, không giả quota; BE-15 OPEN. Không mở mua thêm/nâng cấp.

Tests own-resource/BP mapping, zero quota, canRegister false, missing nullable fields theo NON_NULL, malformed negative quota, currency/amount distinction. UI/real grant QA cần fixture còn quota/hết quota/OPTIONAL/no mapping/legacy. Acceptance purchased projection FE sẵn sàng; legacy quota và chỉnh gói BLOCKED_BY_BACKEND/NEED_BUSINESS_DECISION.
