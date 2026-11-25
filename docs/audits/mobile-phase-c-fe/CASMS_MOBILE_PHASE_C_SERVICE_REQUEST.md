# CASMS Mobile Phase C — SERVICE_REQUEST

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc/sửa: PassengerServiceRequestsScreen, passenger-api/types, service-operation-store; đọc ServiceRequestService/ServiceUsageQuotaService và API client/hook A0. Root cause: visibility cùng booking có thể lẫn BP; edit/cancel thiếu response validation; recovery chỉ owner check và journal queue đọc API URL sau khi chờ.

Sau: ownRequests phải khớp bookingId và bookingPassengerId; trạng thái REQUESTED/ACCEPTED/IN_PROGRESS/COMPLETED/REJECTED/CANCELLED từ DTO. Có nhóm tất cả/đang xử lý/đã sử dụng. Giá tham chiếu snapshot, quantity/note/requestTime/completedAt/fulfilledQuantity và unit server được hiển thị; không dựng ServiceUsage rows không có API. Count không hiện 0 khi chưa tải được request.

Create: selected own active confirmed BP, quantity nguyên dương bounded Java int, note max500. Fresh GET detail/slot/availability trước POST; service stage, price change và full slot có hướng dẫn. Không ép canBuyPreCruise=false chặn khi cruise đã khởi hành; server quyết định operating periods, port-call, entitlement, quota và assignment. Không thêm gate NFC/check-in/boarding.

Giữ một key mỗi intent; journal trong SecureStore native / memory web, namespace owner+API. C thêm quantity/scheduleId/noteFingerprint để giữ intent sau remount, không persist raw note. Note phải nhập lại đúng sau khi mất draft. Fingerprint FNV64 chỉ là client advisory; Backend SHA-256 hash/replay conflict bảo vệ chính thức. Không đồng nhất checksum với bằng chứng bảo mật. Queue serialize double tap và capture URL lúc gọi; compare key trước clear. Chỉ clear khi outcome đã đối chiếu hoặc lỗi từ chối xác định. POST không auto retry; GET by-operation-key trước replay, so đúng ID/quantity/slot/note; payload đổi không được coi là cùng kết quả.

Edit/cancel GET request mới trước action, owner/context/lifecycle guard; update chỉ REQUESTED và không ONBOARD/POS immutable; cancel REQUESTED/ACCEPTED. So response ID/BP/booking/status/quantity trước success. Timeout sửa/hủy lần sau GET kiểm lại, không tự POST lại. Late action guard bỏ ghi/UI từ context cũ.

Tests: malformed HTTP200, snapshots, recovery endpoint/header/body, same-key/double tap/compare-and-clear, API isolation queued writes, intent mismatch, scope changes và business errors. 130 baseline được giữ, stub cũ được cập nhật DTO thật, không skip/xóa. QA timeout sau commit và staff sync cần DB-04/06; API true integration BLOCKED. Acceptance FE source/contract sẵn sàng, lịch sử usage chi tiết chưa có projection (BE-15).
