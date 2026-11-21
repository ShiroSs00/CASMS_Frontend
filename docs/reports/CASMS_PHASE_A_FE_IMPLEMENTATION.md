# Phase A Frontend — Triển khai

Checkout Web Admin nhánh main, HEAD `31249fdaddc54694da39313d0d18d843c8c1f431`. Patch đang ở working tree. Backend chỉ dùng làm nguồn tham chiếu tại `558049c8126bd14743069de01c5ab9e321140d47`.

| Tệp dưới CASMS_WebAdmin | Thay đổi |
| --- | --- |
| src/features/cruises/staffing/staffing-api.ts | Bổ sung snapshot, cặp POS, readiness, reset impact và giải mã response. Khởi tạo staffing đọc lại revision trước POST. |
| src/features/cruises/staffing/ship-review.ts và StaffingV2.tsx | Gate server cho V2, lựa chọn đúng cặp, lý do blocker, cảnh báo reset, tải lại khi conflict/stale, danh sách phân công tôn trọng trạng thái phương án. |
| src/features/cruises/staffing/StaffingInboxPage.tsx và StaffingPreparation.tsx | Hồ sơ kỹ thuật trong công việc Ship theo chuyến. CRM có đường về ngân sách khi API yêu cầu. |
| src/features/cruises/model/program-options.ts, components/CruiseActivityFields.tsx và components/CruisePrograms.tsx | Khu vực hoạt động thuộc model hiệu lực và boong của tàu đang gán. Dịch vụ đề xuất có nhãn riêng. |
| src/features/cruises/components/ServiceLocationRequests.tsx | Hướng dẫn theo shipId và deckBlocker, giữ đề xuất của ASM và xác nhận của Ship. |
| src/features/cruises/api/preparation-api.ts và components/PreparationEvidence.tsx | Giải mã dữ liệu, nộp và xét duyệt độc lập. Dùng revision thật, allowedActions và actor khác người nộp cho thao tác xét duyệt. |
| src/features/cruises/components/OperatingBudget.tsx và components/CruisePlanWorkspace.tsx | Trạng thái duyệt ngân sách riêng, giữ số VND nguyên dạng chuỗi, tải lại hồ sơ chuyến khi lưu. |
| tests/phase-a-contract.test.mjs, tests/phase-a-browser.mjs và tests/cruise-workspace.test.mjs | Ca hợp đồng, tái hiện UI bằng Edge/Playwright và sửa fixture quy định quyền OPS theo route hiện hành. |

## Skill thực sự áp dụng

Lượt finalization dùng thêm frontend-design để làm rõ tên công việc theo role và giảm chiều cao phần tiến độ trên màn nhỏ. Impeccable dùng lại chuẩn OceVie, chạy context và detector cho hai màn staffing. Frontend-testing-debugging, Playwright và code review dùng để đối chiếu bản build, hành vi bàn phím và endpoint thật. Frontend không có Spec Kit skill hoặc CLI để chạy trong lượt này.

- Impeccable, chạy context cho StaffingV2 và dùng craft floor để kiểm tra trạng thái, copy, bố cục theo viewport và dialog. Dùng OceVie và component Web Admin hiện hữu làm nguồn thiết kế.
- Frontend development, kiểm kiểu dữ liệu, trạng thái form, tính nhất quán của React và TypeScript. Code review and quality, rà việc chuyển revision, quyền role và phiên bản legacy. Testing, kiểm hợp đồng và regression với bộ nạp Node có sẵn.
- Frontend testing and debugging, xác minh UI trên preview production qua Playwright. Browser skill riêng không có trong phiên, dùng Playwright đã có trong cache và Edge cục bộ.
- Không tìm thấy Spec Kit skill hoặc CLI trong môi trường Frontend. Đã dùng phân tích hợp đồng, bảng audit và tiêu chí nghiệm thu trong các báo cáo thay cho lệnh Spec Kit.

[API đối chiếu](CASMS_PHASE_A_FE_BE_INTEGRATION.md) · [Nghiệm thu](CASMS_PHASE_A_FE_FINAL_ACCEPTANCE.md)

## Thay đổi trong lượt finalization

| Tệp dưới CASMS_WebAdmin | Thay đổi |
| --- | --- |
| StaffingInboxPage.tsx, ServiceLocationInboxPage.tsx, CruiseWorkHandoff.tsx và admin-navigation.ts | Đồng nhất tên Chuẩn bị phương án tàu cho Ship và Duyệt phương án nhân sự cho OPS. Giữ nguyên route và các kiểm tra role. |
| StaffingV2.tsx và Staffing.module.css | Rút gọn tiêu đề và tiến độ dưới 900 px. Định biên không áp dụng được hiển thị khi phương án đủ điều kiện, không có nhu cầu khu vực và không có ca. POS chỉ gửi lựa chọn đang tồn tại trong danh sách máy được phép. Gộp cảnh báo phương án stale. |
| tests/phase-a-browser.mjs | Kiểm role Ship/OPS, gate readiness null, mở tiến độ bằng Enter, xác nhận/hủy reset và payload revision. |

HEAD Frontend giữ `31249fd`. Thay đổi cuối và patch trước vẫn ở working tree. Backend HEAD `558049c` được khởi động bằng JAR trên PostgreSQL QA riêng. [Lệnh và kết quả](CASMS_PHASE_A_FE_REGRESSION.md) · [Real E2E và ảnh](CASMS_PHASE_A_FE_E2E.md)
