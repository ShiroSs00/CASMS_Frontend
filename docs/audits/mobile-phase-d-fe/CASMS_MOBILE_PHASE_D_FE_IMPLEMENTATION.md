# CASMS Mobile Phase D — FE_IMPLEMENTATION

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Phạm vi: nhân viên phục vụ trên tàu, xác thực thiết bị/phiên, request, activity và bán mới. Đọc toàn bộ pos/, staff-pos/, app/staff-pos/ và Backend PosController/PosActivityController/PosService/PosAccessService/PosLedgerService/PosPermission/PosDeviceAccountController/PosStaffResourceController/PassengerCardController/PassengerCardService/PosActivityService/PosDtos, ServiceRequestService/ServiceUsageQuotaService/ActivityService/OnboardAllowanceService/CruisePackageEntitlementService/RolePermissionInitializer và DTO/enum liên quan. Đối chiếu API/NFC B, API/ServiceRequest/Activities/PackageEntitlements/FinalSummary C.

File thay đổi D, gốc CASMS_MobileApp/src/features/pos/:

- PosLayout.tsx: terminal chooser POS_MANAGE/manual UUID fallback, close cần server xác nhận, expose epoch.
- PosDashboard.tsx: queue count từ query thật, entry theo permission, phân biệt bán mới.
- PosServices.tsx: đủ status filters, snapshot/unit/quantity, fresh context/request trước action và verify outcome; entitlement read theo global permission.
- PosActivities.tsx: fresh scope/registration/participation; quantity edit PENDING giữ notes; action theo lifecycle và verify result.
- PosUsage.tsx: bán mới riêng fulfillment; fresh statement/context; receipt strict; journal giữ unknown outcome; account-wide history rõ nghĩa.
- PosCardAction.tsx: callback nhận BP/name từ lookup server, giữ reader B.
- pos-api.ts/pos-transport.ts/pos-contracts.ts/pos-lifecycle.ts/pos-storage.ts/pos-ui.tsx: auth/API guard cả trước/sau await, strict DTO/postcondition, serialized journal/expected-key clear, chặn late success sau blur.
- Thêm pos-scope.ts: focus và scope guard.
- tests/pos-operations.test.mjs mới; mở rộng session-cleanup.test.mjs; bổ sung fixture Sale đúng DTO trong pos-integration.test.mjs, giữ assertions cũ.

Root cause: preflight dùng cache; receipt thiếu liên kết request/charge; journal có thể overwrite/clear record khác; close lỗi vẫn kết thúc local. Sau sửa: fresh GET, exact identity/lifecycle, receipt đầy đủ, serialize compare/write/clear và server-confirmed close.

Reuse authentication A, native QR/NFC B, entitlement C và OceVie shared primitives; không rewrite store/router, thêm library hoặc refactor web. Test baseline 149 giữ và thêm 15 → 164 pass. Không có screenshot rendered trước/sau hợp lệ, không dùng mockup thay QA. Dependencies giữ B/C; product/usage projection/discovery gaps ghi handoff. Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS, không triển khai E.


Tài liệu D gồm đủ 13 báo cáo tại thư mục này và evidence. Cập nhật hai handoff ở mobile-phase-a0-fe, cùng xác minh D vào FE_MAINTENANCE_BACKLOG hiện có của C. Các thay đổi PosScanner, card-reader/nfc-reader, Passenger screens và package/app config đang thấy trong git status thuộc B/C đã có trước D; D không nhận là thay đổi mới hoặc hoàn tác chúng. Các source thay đổi D nêu ở danh sách trên; source hashes hiện tại ở evidence/verification.json để tái lập kiểm tra.
