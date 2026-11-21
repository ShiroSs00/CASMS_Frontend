# Phase A Frontend — Nghiệm thu

**PARTIAL.** API thật đã đi từ CRM tạo Cruise tới `PENDING_SHIP_REVIEW`. Ship nộp và OPS duyệt được hồ sơ kỹ thuật độc lập. Full E2E staffing **BLOCKED** tại `SHIP_CHECKED` với HTTP 409 `STAFFING_SHIP_PLAN_INCOMPLETE`, vì tàu trong dữ liệu QA chưa có model READY. Frontend main HEAD `31249fdaddc54694da39313d0d18d843c8c1f431`, Backend main `558049c8126bd14743069de01c5ab9e321140d47`. Patch nằm trong working tree, chưa commit hoặc push.

| Vai trò / gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| CRM | PARTIAL | Tạo Cruise, lưu ngân sách và tạo staffing qua HTTP thật. Chưa tới SEND_TO_HR hoặc PLANNER_CONFIRMED trên chuyến QA. |
| ASM | PASS cho chuyến no-service đã dùng | Tài khoản ASM đọc options, nhận và hoàn tất chương trình qua API thật. Ship trả ASM và ASM hoàn tất lại thành công. Case bố trí service được kiểm ở test PostgreSQL. |
| Ship Manager | PARTIAL | Browser thật xác minh CTA khóa do thiếu model READY. Ship nộp hồ sơ kỹ thuật thật. Case chuyến có model READY, không SERVICE đạt ở fixture và test Backend. |
| HR | PARTIAL | Tài khoản HR mở workspace và phân công được Quản lý tàu qua API. Chưa tới phân ca và xử lý trùng lịch trong E2E thật. |
| OPS | PARTIAL | Duyệt TECHNICAL_NAUTICAL bằng tài khoản OPS độc lập qua queue thật. Chưa tới OPS_APPROVED của staffing. |
| Preparation → Cruise Plan → Ready → Open Sale | BLOCKED | Luồng riêng hiện hữu. Chưa có chứng cứ chạy liên tiếp trên một chuyến. |
| Booking Agent, Guest, Mobile, POS | PARTIAL | Booking Agent đăng nhập và mở workspace thật, đồng thời bị chặn khỏi staffing inbox. Chưa có giao dịch Agent trên chuyến đã mở bán hoặc lượt runtime Mobile/POS. |

Web Admin 80/80 test đạt, typecheck, lint, build và Playwright fixture PASS. Backend PostgreSQL targeted 22/22. Lượt hồi quy Web Booking đạt 49/50 và tái hiện lỗi copy baseline. Các skill và tệp thay đổi trong [Triển khai](CASMS_PHASE_A_FE_IMPLEMENTATION.md). Lệnh test tại [Regression](CASMS_PHASE_A_FE_REGRESSION.md). Endpoint, ảnh và điều kiện còn thiếu tại [E2E](CASMS_PHASE_A_FE_E2E.md).

[Audit](CASMS_PHASE_A_FE_AUDIT.md) · [Triển khai và danh sách file](CASMS_PHASE_A_FE_IMPLEMENTATION.md) · [BE/FE contract](CASMS_PHASE_A_FE_BE_INTEGRATION.md) · [UI/UX và ảnh](CASMS_PHASE_A_FE_UI_UX_REVIEW.md)
