# Phase A Frontend — Hồi quy

| Lệnh | Phạm vi | Kết quả |
| --- | --- | --- |
| npm run typecheck | Web Admin | PASS. |
| npm run lint | Web Admin | PASS, max-warnings 0. |
| npm run build | Web Admin | PASS. Vite cảnh báo chunk lớn hơn 500 kB. |
| node --import ./tests/helpers/import-loader.mjs --test 'tests/*.test.mjs' | Web Admin | 80 PASS, 0 FAIL, 0 SKIP. Gồm 11 test hợp đồng mới. |
| node --import ./tests/helpers/booking-loader.mjs --test 'tests/**/*.test.mjs' | Web Booking | 49 PASS, 1 FAIL, 0 SKIP. |
| git diff --check | Frontend | PASS. |
| node CASMS_WebAdmin/tests/phase-a-browser.mjs | Web Admin build + fixture Edge/Playwright | PASS tại 1440, 1366, 768, 390 px. Gồm gate no-SERVICE, thiếu POS, readiness null, role OPS, stale revision, hủy/xác nhận reset và bàn phím. |
| mvn -o -DforkCount=0 -Dtest=ItineraryProgramsPostgresIntegrationTest test | Backend `558049c` + PostgreSQL loopback mới, CASMS_TEST_POSTGRES_URL trỏ tới cổng 56559 | 22 PASS, 0 FAIL/ERROR/SKIP. |
| Playwright login + mở route với Backend thật | CRM, ASM, Ship, HR, OPS và Booking Agent | 6 tài khoản đăng nhập và mở được màn đúng role. Ship Review của Cruise QA cũng mở được và hiển thị gate thiếu model. |

Đã chạy lại cruise-workspace.test.mjs trên bản sao git archive của `31249fd`. Baseline đạt 3/4 và tái hiện lỗi fixture OPS chỉ có CRUISE_READ. Route hiện hành yêu cầu CRUISE_PRICING_APPROVE cho tab chính sách giao dịch và CRUISE_VALIDATE cho tab xác nhận. Đã cập nhật fixture theo quyền hiện hành. Web Booking còn lỗi copy trong activation.test.mjs, kỳ vọng “Thanh toán thành công chưa đồng nghĩa” trong trạng thái Draft. Toàn bộ cây Web Booking, Mobile App và WebApp trùng baseline về mã tracked. Lỗi Web Booking tồn tại trong cây baseline và nằm ngoài phạm vi Phase A.

Booking Agent, pricing và nhóm ship import nằm trong bộ test Web Admin 80 ca. Passenger Mobile và POS App chưa chạy runtime. Các lỗi full suite Backend thuộc báo cáo Backend, không gộp vào số liệu FE. [Backend final acceptance](https://github.com/ShiroSs00/CASMS_Backend/blob/558049c8126bd14743069de01c5ab9e321140d47/docs/reports/CASMS_PHASE_A_BE_FINAL_ACCEPTANCE.md)

Frontend main HEAD `31249fd`, patch Phase A ở working tree. Đã chạy Impeccable detector, Playwright và code review theo danh sách skill trong [Triển khai](CASMS_PHASE_A_FE_IMPLEMENTATION.md). [Endpoint và ảnh](CASMS_PHASE_A_FE_E2E.md)
