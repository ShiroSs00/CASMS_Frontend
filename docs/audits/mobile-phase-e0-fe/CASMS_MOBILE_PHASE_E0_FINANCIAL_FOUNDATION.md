# CASMS Mobile E0 — FINANCIAL_FOUNDATION

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, main, origin/main + working tree B/C/D được giữ nguyên; BE `0bc2b3831301a0d67d45bacc120a161dbacec026`, chỉ đọc, giữ ?? qa/ cũ. Baseline D:164 tests, typecheck/lint/export pass, Doctor19/20. Đã đối chiếu AGENTS gốc/Mobile, OceVie Mobile, báo cáo0/A0/A/B/C/D và handoff. E0 không sửa Backend/DB/Web, không SQL/seed/migration/Maven/API write thật, dependency, commit/push. Contract STATIC_VERIFIED từ source, chưa QA. Áp dụng7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE.

File đọc: booking-financials.ts, passenger-model.ts, PassengerBookingFinancialSummary, passenger-api/hooks/types, PassengerPackagesScreen, PosUsage/contracts/transport/storage; entity/DTO/enums tài chính BE và ledger source ở API_CONTRACT.

File sửa E0:

- CASMS_MobileApp/src/features/passenger-actions/booking-financials.ts: financialMoney là implementation formatter duy nhất trong module này, bookingFinancialMoney wrapper giữ guard không âm cho booking. Thêm opt-in signed cho reversal; financialTransactionStatus theo enum TransactionStatus thực; financialHistoryScope phân biệt account/passenger/unknown.
- Thêm spending-foundation.ts: copy/state thuần cho Spending, không network hoặc financial data store.
- Thêm PassengerSpendingScreen.tsx và route src/app/spending.tsx re-export; chi tiết SPENDING_UI.
- Thêm tests/spending-foundation.test.mjs, giữ mọi test cũ.

Không tạo formatter thứ hai cho Spending. Existing Intl number formatter giữ maximumFractionDigits20 để không cắt 4 decimal; finite number và abs<2^39 là guard D được giữ. Currency phải có3 ký tự uppercase theo contract, không default USD/VND, không FX. Đây là validation hình thức currency code, chưa thay API currency catalogue/rounding policy. Null/undefined/NaN/Infinity/unsafe amount → Chưa cập nhật, zero hợp lệ →0 kèm currency. Signed reversal opt-in giữ dấu âm; booking default vẫn từ chối amount âm. Không sửa POS Sale/Receipt hoặc round ledger, không tính available balance.

TransactionStatus labels: PENDING đang chờ ghi nhận; POSTED đã ghi sổ; FAILED không thành công; VOIDED đã hủy ghi nhận. Không dùng Completed/Settled làm transaction status. TransactionType, SyncStatus, AccountStatus và SettlementStatus là các enum khác, không đồng nhất. Date/time tái sử dụng passenger-model.dateTime; không thêm formatter ngày mới.

Root cause: formatter booking trước đây chặn mọi số âm, phù hợp tiền vé nhưng chưa hỗ trợ signed financial presentation. E0 mở rộng chính implementation hiện có, giữ booking wrapper và regression. Scope label từ explicit contract, không tự lọc account history theo Passenger/BP lẫn nhau. Chưa tạo Financial DTO/network/cache vì ownership/account discovery chưa chốt; future query bắt buộc API/owner/epoch/booking/BP/cruise/account và exact response identity, không ghép tên/cabin.

Tests171/171: null vszero,4decimalUSD/VND không mất precision, signed reversal, unsafe range/currency, status/scope labels; trạng thái Spending và architecture guard không financial transport. Các tests isolation A/C/D/POS vẫn chạy. Không dependency mới. Acceptance foundation ready, Folio BLOCKED_BY_BACKEND, chưa REAL_API_PASSED.
