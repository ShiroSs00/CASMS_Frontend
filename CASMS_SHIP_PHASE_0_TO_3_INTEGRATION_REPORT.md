# CASMS — Báo cáo tích hợp quản lý tàu Phase 0–3

## Baseline và phạm vi

- Backend `a37c4d5ae763c100f58a9e09abfe9abb4b234e98` cùng thay đổi Phase 0–2. Frontend `e9db70a362500ffd80251e3c58c68c87efa79f67` cùng thay đổi Phase 3.
- Mỗi repo có worktree riêng để bảo toàn chỉnh sửa người dùng. Phạm vi Frontend là CASMS_WebAdmin. Các endpoint đổi giá, thanh toán, Booking và Cruise Mainflow giữ nguyên. Không đổi migration cũ.
- Backend dùng ShipType và ShipOperationalProfile ở V121, luồng import hiện tại và bảng IdempotencyRecord. Các tài liệu BE nằm dưới `docs/ship-redesign/`. API theo vai trò và mapping nằm trong [báo cáo triển khai](CASMS_SHIP_PHASE_3_FRONTEND_IMPLEMENTATION.md).

## Kết quả kiểm thử

| Cổng | Kết quả |
| --- | --- |
| Maven package, Java 21 và PostgreSQL 16.15 | 61 test đạt, trong đó 33 test HTTP/PostgreSQL. Flyway áp dụng và validate 113 migration đến V122. Đã có JAR. |
| WebAdmin TypeScript, ESLint và Vite | Cả ba lệnh typecheck, lint và build đều đạt. Vite còn cảnh báo chunk ModelCanvas/Three.js 645 kB và đã tải lười. |
| WebAdmin import regression | 20 ca qua ở cổng cuối. |
| WebAdmin workflow tests | 4 ca qua, bao gồm multipart, asset ghim, payload tối thiểu, RBAC, validation và đọc kết quả theo key. Mock chỉ dùng cho kiểm tra contract FE. |
| Hồi quy Pricing WebAdmin | 10 ca qua. |
| Browser E2E | Trình duyệt in-app, Vite localhost và JAR Backend thật trên PostgreSQL QA. Desktop 1265 px và tablet 768 × 1024. |

## Nghiệm thu end-to-end

- [x] Admin đăng nhập và mở danh mục theo quyền runtime. Upload ZIP QA, đọc `manifest.name`, thấy mô hình GLB, lưu đúng assetVersion từ bản xem trước. Chi tiết loại báo chưa có tàu.
- [x] Ship Manager chọn loại ACTIVE, thấy lỗi cạnh ô tên bỏ trống, rồi tạo Aurora 01 và Aurora 02 từ cùng loại. Mỗi tàu có UUID và mã SH riêng. Không có upload ZIP khi tạo tàu vật lý.
- [x] Đổi tên Aurora 01, Aurora 02 giữ tên, loại vẫn là Tàu thử nghiệm OceVie. Hồ sơ Aurora 02 đọc đúng số IMO đã nhập. Ship mới ở DRAFT.
- [x] Hồ sơ Aurora 01 xem GLB đúng tàu, chọn cabin QA-01 và nhận trạng thái ánh xạ. Backend xác minh hai tàu có UUID Deck và Cabin khác nhau dù chia sẻ asset. Nguồn thiếu 2D hiện empty state.
- [x] Bảng hiện loại đúng và tàu legacy hiện Chưa phân loại. Enter áp dụng bộ lọc. Phạm vi tablet cuộn trong bảng. Điều hướng loại sang tàu và từ tàu sang loại.
- [x] Ship Manager bị chặn tại màn tạo loại. Backend chặn ghi loại/asset theo role. Thiếu hồ sơ khi chuyển READY trả đúng các nhóm. Tab lịch tải được trạng thái chưa có chuyến.
- [x] PostgreSQL kiểm tra retry đồng thời, xung đột payload, rollback và đọc lại kết quả. Browser kiểm chứng luồng thành công. Mất kết nối giữa POST và response được kiểm tra ở test contract FE và test idempotency Backend.

## Giới hạn

- Một test nền `crmCanStillReadDraftsWhilePublicCatalogUsesSaleFilter` kỳ vọng mock `CruiseService.list` còn controller gọi `listVisibleForStaff`. Ca này đã chạy và thất bại trước khi bị loại riêng khỏi cổng nghiệm thu. Cruise code giữ nguyên.
- Gói Zaandam v12 thiếu `shipManufacturerName` và `engineType`. Giữ validation và file nguồn. Browser E2E dùng ZIP dữ liệu QA có đủ trường, GLB tự chứa và database cô lập. Tài khoản QA và ZIP không đưa vào repo.
- GET `/ships` chưa hỗ trợ tổ hợp tìm tên/mã, trạng thái và loại. Tìm/lọc kết hợp dùng các trang của phạm vi được phép. Luồng loại tới tàu có truy vấn DB riêng.
- UI lịch khai thác đã kiểm tra ở trạng thái chưa có chuyến. Chưa có E2E riêng cho tàu có chuyến đang chạy, dữ liệu 2D hoặc trình đọc màn hình.

Xem [audit](CASMS_SHIP_PHASE_3_FRONTEND_AUDIT.md), [triển khai](CASMS_SHIP_PHASE_3_FRONTEND_IMPLEMENTATION.md) và [rà soát UI/UX](CASMS_SHIP_PHASE_3_UI_UX_REVIEW.md).

## Chạy lại

1. Dùng PostgreSQL cô lập. Trỏ cấu hình Backend vào database QA và áp dụng Flyway khi chạy JAR. Tạo hoặc dùng tài khoản Admin và Ship Manager đã cấp đúng quyền. Các database làm việc cần được giữ riêng khỏi dữ liệu QA.
2. Tại WebAdmin, đặt CASMS_API_PROXY_TARGET tới Backend local. Chạy npm run dev. Đăng nhập Admin và mở Quản lý loại tàu. Dùng ZIP hợp lệ với tên, nhà sản xuất và động cơ đầy đủ.
3. Đăng nhập Ship Manager. Mở Danh sách tàu, chọn Thêm tàu và chọn loại vừa lưu. Kiểm tra thông tin chung, cabin, mô hình và lịch khai thác.
4. Chạy các cổng FE tại CASMS_WebAdmin bằng npm run typecheck, npm run lint, npm run build, npm run test:ship-import và node --import ./tests/helpers/import-loader.mjs --test ./tests/ship-workflow.test.mjs.
