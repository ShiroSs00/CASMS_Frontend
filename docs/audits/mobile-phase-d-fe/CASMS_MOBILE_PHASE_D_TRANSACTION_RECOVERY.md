# CASMS Mobile Phase D — TRANSACTION_RECOVERY

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Đọc và sửa storage/Usage/api/ui. Root cause: journal có thể overwrite intent; clear thiếu expected key; scope guard chỉ trước await; late success sau blur.

SecureStore journal gắn API/employee/terminal/area/cruise/signedInAt và toàn SaleInput/serviceName. Terminal key giữ một pending operation. Legacy key được đọc rồi promote trước replay. Serialize compare/write/clear trong JS runtime; khác owner/API/area/cruise không lộ payload, overwrite hoặc delete. Clear kiểm expected key; cùng intent so theo fields, không theo property order. Epoch cũ cùng owner có cảnh báo và chỉ replay sau xác nhận chủ động; không blind replay. Đóng modal/logout/đổi terminal không xóa operation.

UI lock chặn double tap, không auto retry mutation. Một key tạo trước review, journal lưu trước POST. Network/timeout/5xx/429/malformed/stale response/conflict giữ exact input/key. Definitive business rejection của lần gửi mới có thể clear đúng record; replay lỗi bất kỳ vẫn giữ. Commit thành công nhưng storage clear lỗi giữ receipt và hướng dẫn replay cùng key.

Recovery đã xác minh: manual POST /pos/sales cùng key/exact intent; BE tìm (terminal,key), kiểm fingerprint/area/cruise, trả existing sale. Có saleId dùng GET /pos/sales/{id}. Không GET by key; không bịa endpoint hoặc kết luận fail từ list. Mất permission/assignment hoặc không replay được thì giữ journal và liên hệ quản lý, BE-19.

Guard sau await kiểm owner/epoch/API; POS_STALE_RESULT 502 giữ ambiguous write. Focus guard trước gửi, suppress success sau blur. Request/activity không dùng sale journal chung; phải đọc GET mới trước lần thao tác tiếp.

Tests concurrent intent, stale clear, owner/environment/epoch, canonical input, late employee response và same key pass. Queue không là distributed lock; Backend unique/replay là authority. Native crash/restart/timeout sau commit chưa chạy QA. Legacy journal chưa có epoch không được tự replay, vẫn cần người dùng kiểm tra và xác nhận cùng intent. Acceptance source ready; management recovery BLOCKED_BY_BACKEND, device gate pending; không dependency mới.

Nếu đồng thời tồn tại legacy và terminal journal khác intent, đọc trả blocked, save/clear từ chối và giữ cả hai record cho đối soát. Test mới kiểm trực tiếp trường hợp này. Journal thiếu epoch cũng hiện cảnh báo lần đăng nhập trước khi consumer có epoch hiện tại.
