# CASMS Mobile Phase D — POS_SALES

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc PosUsage/PosService/PosLedger/OnboardAllowance/DTO; sửa Usage/contracts/transport/lifecycle và CardAction callback.

Bán service cần SERVICE_SALE và quantity contract=1; không giả product sale hoặc nhiều quantity. Price/currency từ current server context, null không miễn phí. Statement xác minh account/BP trước review. GET context và statement mới trước POST mới; giá đổi cần review lại, hạn mức/currency không phù hợp thì chặn. Backend kiểm membership/ship/cruise/retail flags/pricing/quota/allowance và USD guard. FE không gửi giá, đổi tỷ giá hoặc trừ số dư.

Manual BP/account UUID theo contract; BE kiểm ownership. Khi có CHECKIN_BOARDING, reuse B reader và official lookup điền BP. Không nhập UID/QR claim làm payment identity hoặc suy account từ thẻ. Thiếu lookup permission ghi BE-14; hardware B2 không chặn manual ID/service flow được BE hỗ trợ.

Review Bán dịch vụ mới hiện service, 1 lượt, current price/currency, BP/account/schedule. Bỏ gợi ý schedule từ request mở; cảnh báo BP/service đang có request và hướng dẫn xử lý request đó. POST atomic tạo request+charge+ledger+sale; fulfillment sau đó không sale mới. Receipt cần saleId/serviceRequestId/chargeId/unitPrice/amount/currency và đúng employee/terminal/area/service/BP/account/quantity. Amount=unitPrice theo quantity = 1.

Financial parser dùng finite JSON number, abs<2^39 để giữ 4 decimal; giữ history âm, currency ISO3 uppercase, không null→0. SaleDTO không trả scheduleId/key nên FE không tuyên bố verify hai trường đó từ receipt; Backend kiểm replay fingerprint. Receipt hiện requestId để đối chiếu.

Root cause cũ trộn fulfillment/sale và receipt thiếu ràng buộc. Tests strict receipt, wrong scope, financial range/currency, no auto retry và same key pass. QA atomic debit/request/charge chưa chạy; product sale BLOCKED_BY_BACKEND BE-20. Không nâng dependency; acceptance FE_READY_WITH_EXTERNAL_BLOCKERS.
