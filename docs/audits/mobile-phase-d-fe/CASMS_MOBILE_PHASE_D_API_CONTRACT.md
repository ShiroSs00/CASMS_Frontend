# CASMS Mobile Phase D — API_CONTRACT

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Các URL sau base /api. Mọi /pos/... cần employee JWT + X-POS-Session, POS_ACCESS, enabled/nonlocked principal; Backend xác minh terminal/area/ship/cruise/employee assignment và giao resource policies. Không suy permission từ FE role.

| Method / URL | Request → response DTO | Permission / scope / consumer | Lifecycle / idempotency / errors |
|---|---|---|---|
| GET /auth/me | → UserMeResponse | employee JWT; EmployeeGate | ACTIVE/effectivePOS_ACCESS; 401/403 |
| POST /auth/login | username/password → token/user | device role chỉ POS; PairTerminal, authenticated:false | device token không thay employee JWT; INVALID_CREDENTIALS/ACCOUNT_DISABLED |
| GET /ships/{shipId}/pos-terminals | shipUUID → Terminal[] | POS_MANAGE; chooser | management list, không employee discovery;403/404 |
| POST /pos-terminals/{terminalId}/sessions | một deviceSecret/deviceAccessToken, areaId?/cruiseId? → Session | employee POS_ACCESS, không POS header | open/expiry/assignment; không retry; POS_CRUISE_SELECTION_REQUIRED/400/403 |
| GET /pos/session | tokenheader → Context | current employee/session; ActiveSession | restore/resume reverify;401/403/404 |
| DELETE /pos/session | tokenheader →204 | cùng session; dashboard | chỉ clear local sau confirm; timeout giữ và GET |
| GET /pos/services | →AvailableService[] | SERVICE_READ resource; catalogue | live nullableprice/currency; không null→0 |
| GET /pos/requests | →ServiceRequestView[] | SERVICE_REQUEST_READ resource; dashboard/requests | cruise/ship/service scope,403 |
| POST /pos/requests/{id}/actions/{action} | Fare complete: fulfilledQuantity/unitCode; còn lại no body →RequestView | ASSIGN hoặc EXECUTE resource; PosRequests | assign/accept/reject/start/complete/cancel; full quantity/unit; GET trước retry; BENEFIT_FULFILLMENT_QUANTITY_INVALID/quota/lifecycle |
| Service usage | không có POS write riêng được FE gọi | ServiceRequestService.recordUsage khi complete | SERVICE_COMPLETE:id dedupe, quota/window/grant BE; không POST sale |
| POST /pos/passenger-cards/preview | code →BP/name | POS_ACCESS+CHECKIN_BOARDING; B scanner | claim TTL/one-time, không paymenttoken; CLAIM_INVALID |
| POST /pos/passenger-cards/confirm | code/cardIdentifier →assignment | như trên; B | atomic consume/assign; timeout lookup; ALREADY_ASSIGNED |
| POST /pos/passenger-cards/lookup | cardIdentifier →assignment | như trên; PosCardAction callback BP | không manualUID, không suy identity ở FE;BE-14 |
| GET /pos/activities | →AvailableActivity[] | ACTIVITY_READ terminal/resource; PosActivities | onboard only, cruise/area/deck scope |
| POST /pos/activities/{id}/actions/{open,start,complete,cancel} | no body →ActivityView | ACTIVITY_LIFECYCLE | PLANNED→OPEN→IN_PROGRESS→COMPLETED, cancel theo service; GET mới |
| GET/POST /pos/activities/{id}/registrations | POST BP/quantity →RegistrationView; GET list | REGISTRATION hoặc ATTENDANCE đọc; REGISTRATION ghi | create PENDING, positive Java int; duplicate/capacity/owner BE |
| PUT /pos/activity-registrations/{id} | quantity/notes →RegistrationView | ACTIVITY_REGISTRATION | PENDING only, GET mới và giữ notes |
| POST /pos/activity-registrations/{id}/actions/{confirm,cancel} | no body →RegistrationView | ACTIVITY_REGISTRATION | confirm PENDING; cancel PENDING/CONFIRMED trước start; no auto retry |
| GET /pos/activities/{id}/participations | →ParticipationView[] | ACTIVITY_ATTENDANCE | nối registrationId, GET mới |
| POST /pos/activity-participations/{id}/actions/{check-in,checkout,complete,no-show} | →ParticipationView | ACTIVITY_ATTENDANCE | REGISTERED→CHECKED_IN→IN_PROGRESS→COMPLETED; no-show sau end |
| POST /pos/sales | serviceId/BP/accountId/scheduleId?/quantity=1/idempotencyKey →Sale | SERVICE_SALE resource; PosUsage | atomic request+charge+ledger+sale; same key/exact intent replay, không auto retry; POS_IDEMPOTENCY_CONFLICT/PRICE_REQUIRED/AMOUNT_TOO_LARGE/ALLOWANCE_EXCEEDED/SPENDING_LIMIT_EXCEEDED |
| GET /pos/sales/{saleId} | →Sale | SERVICE_SALE resource | known ID recovery; không GET by key |
| GET /pos/accounts/{accountId}/passengers/{BP}/statement | →Statement(Budget,History[]) | SERVICE_SALE; BE account/BP/cruise membership | Budget.passengerId là PassengerID; history account-wide; POS_ACCOUNT_CURRENCY_MISMATCH |
| GET/PUT /booking/{id}/onboard-allowance | AllowanceInput →Allowance | POS_MANAGE management | chỉ audit, không cấp/sửa allowance trong StaffPOS, không POSheader |
| GET /servicepackage/requests/{id}/fare-entitlement | →OperationEntitlement | global SERVICE_REQUEST_READ/CREATE/EXECUTE +staff | optional scoped request projection; noPOSheader; checkoperationId/BP; canRegister không là fulfillpermission |

Root cause/gap: terminal list dành quản trị; không có product sale hoặc usage-list/legacy remaining quota đồng nhất. Statement History thiếu BP nên không lọc theo suy đoán. Không gọi passenger actions thay staff scoped endpoint. Sale replay có key thực; request/activity recovery GET hiện trạng, không tự kết luận ai đã ghi.

DTO strict theo Jackson NON_NULL: omitted nullable normalize null, không unknown→zero. Sale bắt buộc requestId/chargeId/unitPrice/amount, currency ISO3 và safe amount. Tests transport stub chỉ adapter contract, chưa deployment integration. Consumer/source thay đổi xem FE_IMPLEMENTATION. Không thêm dependency; acceptance STATIC_VERIFIED với BE-14/15/16/18/19/20 và DB-04/06 mở.


M17 deck assignment semantics giữ nguyên: scoped source/area/terminal/employee policies và Backend venue checks là authority. Không lấy catalogue global làm bằng chứng service/activity được phép tại quầy; unlink/disable/mismatch cần QA. M06/M07 Folio giữ dependency Phase E, không dùng POS statement thay thế hoặc ngược lại.
