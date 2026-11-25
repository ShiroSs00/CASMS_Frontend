# CASMS Mobile Phase G — RENDERED_UI_QA

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Flow dự kiến: Login → Home → itinerary/services/activities/packages/QR/notifications/account/spending/support; employee → terminal/session → dashboard/requests/fulfillment/activities/scanner/sale/statement. Các flow này CHƯA chạy trên product UI trong G.

| Check | Result | Evidence |
|---|---|---|
| Browser availability | Browser skill/plugin absent; CUA IAB present nhưng webview attach thất bại | Hai lần createBrowserTab(127.0.0.1:8086/login) timeout |
| Playwright fallback | Không có playwright/@playwright/test/puppeteer trong Mobile node_modules | Không install khi chưa duyệt |
| Native | AVD boot1/ExpoGo58.0.5; dev-client package chưa có | android-runtime.txt; chưa UI render |
| Page identity/not blank/framework overlay | NOT_VERIFIED | Không DOM/screenshot app |
| Console health | NOT_VERIFIED | Metro warning không thay thế browser console |
| Before/after screenshots | NOT_AVAILABLE | Không mockup/ảnh generate thay app |
| Primary action/failure/retry loop | NOT_RUN | Không claim interaction pass |
| Phone320/375/430 | STATIC layout logic review only | G-06/G-07, no viewport screenshot |
| Tablet768/1024/1280 | POS effective-width unit tests only | Không TABLET_UI_PASSED |
| Native landscape | N/A theo app orientation portrait | Không đổi orientation toàn app |
| Keyboard/safe area/scroll/modal/Back/font scale | Source safeguards; rendered NOT_RUN | Phase M cần thiết bị/build |

Fixture preview nếu chạy được sau này phải ghi rõ FIXTURE_UI_ONLY. RealBackend QA chỉ được chạy khi đội BE/DB xác nhận URL/actors/dataset/quyền mutation. Không có credential/JWT/claim/UID trong screenshot vì không có screenshot sản phẩm mới.

G-10 vẫn OPEN; route inventory và source implementation tiếp tục đủ phạm vi dù runtime bị chặn. Không dùng export pass để đóng visual gate.
