# V13 — Demo Booking bằng fixture cục bộ

**UI PREVIEW — NO LIVE BACKEND.** Đây là demo giao diện với dữ liệu tổng hợp, không chứng minh API thật hoạt động. Mọi `/api/` bị chặn tại preview server; route không biết trả 404, không forward BE. API base được cố định `/api` riêng cho preview, kể cả khi máy có VITE_API_BASE_URL khác. Không dùng tài khoản, mã Booking hoặc thông tin khách thật.

## Khởi chạy và reset

Từ `C:/Users/USER/OneDrive/Documents/GitHub/CASMS_Frontend/CASMS_WebApp`:

```powershell
node tests/booking/preview-server.mjs
```

Mở **http://127.0.0.1:5177/cruises?__fixture=ready**. Phải có banner `UI PREVIEW — NO LIVE BACKEND` trên đầu trang. Nếu không có banner, dừng demo. Port bận thì dùng server preview đã chạy hoặc Ctrl+C đúng terminal của nó; không thay bằng FE live port 5173. Server từ chối NODE_ENV=production; không bundle fixture vào sản phẩm.

- Chỉ một người điều khiển, không chạy song song bộ browser test hay nhiều demo: scenario là state của process, dùng chung các tab.
- Mỗi case bắt đầu bằng tab/context mới tại URL được chỉ định (để xóa draft/result/unknown lock trong bộ nhớ). Chọn scenario bằng URL `__fixture` reset trạng thái cabin giả lập.
- Khi case yêu cầu giữ draft và đổi dữ liệu, mở **tab điều khiển thứ hai** tại `http://127.0.0.1:5177/__fixtures/select?__fixture=SCENARIO`. Tab đó chỉ trả JSON có tên scenario; quay lại tab demo. Không reload tab demo đang có draft.
- Không dùng nút Back để reset uncertain outcome; gửi lại phải tiếp tục bị khóa trong context hiện tại. Context mới chỉ là reset fixture, không phải hướng dẫn xử lý Booking thật chưa rõ kết quả.
- Desktop: 1280, 1440 hoặc 1920 px. Giữ tiền tệ `USD`, kế hoạch `DEPOSIT`. Không diễn giải con số fixture thành giá thương mại.

## Dữ liệu cố định

| Dữ liệu | Giá trị tổng hợp |
| --- | --- |
| Cruise A / B | `11111111-2222-3333-4444-555555555555` / `22222222-3333-4444-5555-666666666666` |
| Cabin 101 | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, sức chứa/còn chỗ 2; cabin 102 còn 0 |
| Gói | `cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa`, DEV · Gói mẫu, 20 USD riêng, không phải tổng Booking |
| Người đại diện | `Khách QA V13`, `qa@example.test`; số thay thế `+84900000000` |
| Reference | `DEV-BOOKING-ONLY`; contract `DEV-CONTRACT-ONLY` |
| Kết quả mẫu | Booking Draft/Nháp, contract Draft/Bản nháp, đợt Scheduled/Theo lịch; 125 USD, cọc 37.5 USD |

POST chỉ được giả lập trong process, không lưu DB. Reference luôn cố định; lookup dùng record mẫu độc lập với dữ liệu vừa gõ (không mô phỏng persistence). Không trình bày lookup là bằng chứng một booking đã được lưu. “Đã tiếp nhận” là trạng thái UI mẫu; không có xác nhận chuyến, hợp đồng có hiệu lực hay thu tiền.

## Các case chạy lặp lại

`A` dưới đây là UUID Cruise A ở bảng trên. Ba route bước lần lượt: `/booking/cabin-experience`, `/booking/passengers`, `/booking/review`; query giữ `cruiseId=A&from=...`.

| ID / scenario | Route đầu, thao tác chính xác | Kết quả cần thấy |
| --- | --- | --- |
| D01 / `ready` | `/cruises?__fixture=ready` → **Xem hành trình** → **Chọn phòng & đặt chỗ**; chọn 101, gói mẫu → **Tiếp tục nhập hành khách**; nhập tên/email mẫu → **Kiểm tra đặt chỗ**. Chọn **Sửa thông tin hành khách**, quay lại review; chọn **Sửa phòng & gói**, quay lại review. | Draft giữ nguyên; giá gói tách riêng, chưa có tổng giá trước gửi. Chưa phát POST. |
| D02 / `ready` | Tiếp D01 → **Kiểm tra và gửi đặt chỗ** → **Gửi đặt chỗ** trong modal. Sau kết quả chọn **Tra cứu đặt chỗ**, nhập email mẫu → **Tra cứu**. | Một simulated POST. Reference mẫu, Draft, contract nháp, lịch yêu cầu thanh toán; không có “đã trả tiền”. Lookup là record dựng sẵn như giải thích trên. |
| D03 / `catalog-pages` | `/cruises?__fixture=catalog-pages` → **Trang sau →** → **Xem hành trình** → **← Về danh mục** → lọc **Nhiều ngày** → detail → Booking. Chọn phòng/gói và nhập tên/email, review → **Sửa phòng & gói**, đổi sang `DEV-TWO`. | Trang 2 có Cruise B, quay lại giữ page=2; đổi filter bỏ page, chỉ còn A. Đổi cruise trong checkout xóa cabin/package, giữ tên/email. Deep link: `/booking/cabin-experience?cruiseId=A&__fixture=catalog-pages` chọn đúng A. |
| D04 / `ready` | `/booking/cabin-experience?cruiseId=A&__fixture=ready`; chọn 101 → **Thêm hành khách**, chọn 101 cho người 2 → thêm người 3. Bỏ người 3, tiếp tục; nhập hai tên, email đại diện; Passport và cùng số `QA123` cho cả hai → review. Đổi người 2 thành `QA456`, tiếp tục. | Người 3 không thể chọn phòng 101; hai người được ở chung. Duplicate bị chặn tại giấy tờ người 2, sửa xong mới review. Không gửi dữ liệu thật. |
| D05 / `create-stale` | `/booking/cabin-experience?cruiseId=A&__fixture=create-stale`; hoàn thành như D01, gửi một lần trong modal; sau 409, bấm **Tiếp tục nhập hành khách**. | Quay bước 1, GET phòng lại: 101 còn 0; validation chặn tiếp tục/gửi. Không có kết quả thành công, không tự POST lần hai. |
| D06 / `ready` → `packages-stale` | Làm D01 có gói. Tại review chọn **Xem hành trình khác**. Tab điều khiển chọn `packages-stale`, quay tab demo và browser Back, bấm **Kiểm tra và gửi đặt chỗ**. | Fresh GET loại gói INACTIVE; về bước 1 với lỗi gói. Chọn **Không chọn gói**, tiếp tục/review được; tên/email giữ nguyên. |
| D07 / `create-unknown` | `/booking/cabin-experience?cruiseId=A&__fixture=create-unknown`; nhập như D01, gửi trong modal → Escape. Có thể mở lookup rồi browser Back. | Kết quả chưa xác định, có thể đã tiếp nhận; gửi lại bị khóa. Focus vùng phục hồi sau Escape/Back; không hiển thị “chưa gửi được” hay thành công. Không có mã thì không bịa mã để tra cứu. |
| D08 / lookup cases | `/booking/lookup?__fixture=lookup-mismatch`; nhập reference/email mẫu → **Tra cứu**. Tab điều khiển lần lượt `lookup-not-found`, `lookup-unavailable`, `lookup-empty`, mỗi lần quay tab demo bấm **Tra cứu**. Cuối cùng chọn `ready` rồi **Tra cứu**. | 403/404 cùng text no-match; 502 và 200/null không có fake result/raw detail. Inputs giữ nguyên; retry ready có kết quả mẫu. |
| D09 / bounded states | Tab mới lần lượt `/cruises?__fixture=loading`, `/cruises?__fixture=empty`, `/cruises?__fixture=error`; rồi `/booking/cabin-experience?cruiseId=A&__fixture=cabins-empty`, `packages-empty`, `package-error`, `cabins-sold-out`. | Loading có tên tài nguyên; catalogue rỗng/lỗi không có mock fallback. Cabin rỗng có retry, sold-out không chọn được. Gói rỗng/lỗi có thể bỏ qua, gói lỗi có retry. |

`create-rejected` là 409 cố định nhưng không đổi số chỗ; dùng D05 để demo stale availability đầy đủ. Offline được test bằng browser route abort cục bộ trong suite, không cần ngắt mạng máy hay BE. Chuyển scenario không tự cập nhật GET đã cache; dùng retry hiện có hoặc rời trang/Back như hướng dẫn D06.

## Chạy lại kiểm chứng

Có sẵn Playwright ở máy này; không cài dependency mới:

```powershell
$env:CASMS_PLAYWRIGHT_MODULE='C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node --test --test-concurrency=1 tests/booking/v13-scenarios.browser.mjs tests/booking/v12-recovery.browser.mjs tests/booking/refinement.browser.mjs
npm run lint
npm run typecheck
npm run build
```

Không chạy các fixture suites đồng thời vì scenario dùng chung. Kết quả và giới hạn thực tế: [OCV_V13_SCENARIO_QA.md](OCV_V13_SCENARIO_QA.md). Backend prerequisites: [OCV_V13_BE_HANDOFF.md](OCV_V13_BE_HANDOFF.md). **Live E2E vẫn BLOCKED**; không chuyển demo sang live POST khi chưa có sandbox được cho phép rõ ràng.
