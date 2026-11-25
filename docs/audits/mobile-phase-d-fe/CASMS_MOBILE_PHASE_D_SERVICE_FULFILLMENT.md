# CASMS Mobile Phase D — SERVICE_FULFILLMENT

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc và sửa PosServices, contracts, lifecycle, transport; đối chiếu ServiceRequestService, ServiceUsageQuotaService, Fare entitlement, PosLedger và Phase C.

Trước khi ghi: GET context mới và kiểm terminal/ship/area/cruise/assignment; GET scoped requests, so exact request ID/BP/service/schedule/quantity/Fare snapshot/unit/status/assignee; kiểm quyền/action; POST; verify identity, expected lifecycle và full quantity; invalidate toàn pos.key. Nếu nhân viên khác đã thay đổi dữ liệu, cache nhận GET mới và yêu cầu xem lại, không ép trạng thái local.

Bộ lọc gồm đủ 6 trạng thái và open/mine/all. Row hiện BP, schedule ID, quantity, fulfilled quantity/unit, note, request/completed time và price snapshot. Cabin/tên hành khách không có trong RequestView nên không join phỏng đoán. ASSIGN cần SERVICE_REQUEST_ASSIGN. FE giữ EXECUTE trên own assignment: accept/reject/cancel REQUESTED; start/cancel ACCEPTED; complete IN_PROGRESS; các terminal states không action.

Fare complete cần nhập đủ quantity và đúng unit snapshot, không partial. Non-Fare không tự thêm body. Backend khóa service, kiểm Confirmed booking, IN_PROGRESS cruise, ngày/slot, legacy prepaid, quota và Fare grant; lưu ServiceUsage với operation SERVICE_COMPLETE:id một lần rồi COMPLETED. Existing POS sale request đã có charge: complete không POST sale và không thêm charge mới.

Optional projection /servicepackage/requests/{id}/fare-entitlement theo employee global READ/CREATE/EXECUTE, kiểm operationId/BP, không X-POS-Session ngoài /pos. Reuse EntitlementSummary đọc server, không tự trừ quota. canRegister không thay quyền fulfill; Backend quyết định khi complete. Chưa có usage list/legacy quota projection đầy đủ: BE-15 giữ mở.

Root cause cũ là cache preflight và thiếu postconditions. Nay đọc mới và verify; timeout yêu cầu đóng sheet, GET trước lần thao tác tiếp, không auto retry. Invalidation gồm request/catalog/entitlement/statement dưới POS prefix. Passenger app có cache riêng, cần refetch server, không local bridge.

Tests ownership/full quantity/identity/cross-adapter pass. QA kiểm đúng một usage/charge và projection trước/sau chưa chạy. Acceptance FE_READY_WITH_EXTERNAL_BLOCKERS; projection thiếu contract BLOCKED_BY_BACKEND. Dependencies giữ nguyên.
