# CASMS Mobile — Tổng hợp Phase 0

**24/11/2026 · FE `3c01db0` · BE `0bc2b38`**

Phase 0 hoàn tất rà soát source và lập báo cáo. Mobile đã có nền tảng companion và POS trên API thật ở lớp implementation. Luồng Web Booking → kích hoạt → Passenger → POS → sao kê/thông báo vẫn cần nghiệm thu trên PostgreSQL QA và thiết bị. Typecheck, lint, 98/98 test Mobile và export Android/iOS/Web pass. Backend compile pass, 82/86 unit/contract và 40/41 POS PostgreSQL pass. Flyway áp dụng 131 migration đến V140, nhưng 5 assertion trong bộ integration vẫn kỳ vọng mốc cũ. 7 test HTTP Mobile chưa qua login. Fixture Asian voyage bị chặn do lifecycle Ship. Xem [báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md).

| Nhóm | Có implementation | Cần xử lý trước nghiệm thu |
|---|---|---|
| Account, voyage, booking | JWT, restore/refresh, chọn chuyến, dữ liệu booking/cabin/lịch trình, lịch sử thanh toán vé | Xác nhận bàn giao kích hoạt từ Web M08 và hủy booking M01. |
| Dịch vụ và hoạt động | Danh mục, slot/availability, CRUD nghiệp vụ yêu cầu, đăng ký/hủy, tour cảng, quyền lợi gói | Xác nhận fixture, lịch/slot/quota, quyền sửa draft và phản hồi từ POS qua Backend thật. |
| POS | Employee/device credential, terminal scoped sale, request fulfillment, registration/attendance và statement | Claim/preview/confirm/lookup, NFC trên thiết bị và fixture đủ actor/terminal. |
| Chi tiêu Passenger | Route hướng dẫn tới quầy và đặt chỗ | Thiếu folio thật, hạn mức, ledger/settlement/checkout. Ưu tiên ràng buộc scope folio M06 (P0) và bỏ dữ liệu mẫu M07. |
| Hải trình, thông báo, hỗ trợ | Itinerary, timezone theo ngày, lịch sử, list/read và hướng dẫn hỗ trợ | SSE/unread/read-all/ACK, realtime resume, kênh hỗ trợ và lựa chọn 3D theo kích thước asset. |
| UI/UX | OceVie tokens, shared scaffold, sheet/keyboard và reduced motion có source | Test thiết bị nhỏ, tablet POS, screen reader, hardware back, fonts và danh sách lớn. |

## Bảy điểm cần xác minh

| Điểm | Kết quả trên baseline |
|---|---|
| 1. Mobile dùng API hủy cũ | Xác nhận. `passenger-api.ts:151` POST `/booking/{id}/cancel`. |
| 2. BE đã chuyển workflow | Xác nhận có điều kiện. Workflow mặc định bật trong `application.yml:88`, route cũ trả 409 khi bật. Workflow mới dùng `/booking/{id}/cancellations`. |
| 3. Passenger QR thiếu card claim | Xác nhận. Route là placeholder, BE có claim. |
| 4. POS Scanner chưa có cấp thẻ | Xác nhận. Camera quét QR, chưa gọi preview/confirm/lookup. Swift tham chiếu có contract. |
| 5. Spending chưa có sao kê thật | Xác nhận cho Passenger. Staff POS có adapter truy vấn statement. |
| 6. Thiếu SSE Mobile | Xác nhận. List/read đã có, SSE/read-all/count/ACK chưa được dùng. |
| 7. QA chưa đồng bộ migration | Có bằng chứng. Flyway suite chứa 5 assertion giữ mốc hoặc số migration trước V140. Checksum lock thiếu V140 và seed Asian voyage dùng Ship ACTIVE bị constraint V74 chặn. |

## Gate triển khai

Chốt luồng bàn giao tài khoản, hủy booking và phạm vi check-in trước khi sửa UI. Roadmap đi từ A (Auth/Voyage), B (Check-in/Thẻ), C (Dịch vụ/Hoạt động), D (POS), E (Folio/Settlement), F (Hải trình/Realtime/Hỗ trợ), G (Native UI/performance) đến H (E2E). Phần thực thi Phase A–H chưa bắt đầu. Skill Expo bắt buộc đã dùng theo tên cài thực tế. Development client, deployment và compatibility được đối chiếu tài liệu Expo SDK 58.

## Bộ báo cáo

- [Kiến trúc và chất lượng Mobile](CASMS_MOBILE_PHASE_0_FE_AUDIT.md)
- [Backend](CASMS_MOBILE_PHASE_0_BE_AUDIT.md)
- [Ma trận API](CASMS_MOBILE_PHASE_0_API_CONTRACT_MATRIX.md)
- [Passenger](CASMS_MOBILE_PHASE_0_PASSENGER_AUDIT.md)
- [Staff POS](CASMS_MOBILE_PHASE_0_STAFF_POS_AUDIT.md)
- [UI/UX OceVie](CASMS_MOBILE_PHASE_0_UI_UX_AUDIT.md)
- [Kết quả kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md)
- [Roadmap A–H](CASMS_MOBILE_PHASE_0_IMPLEMENTATION_ROADMAP.md)
- [Skills và tài liệu](CASMS_MOBILE_PHASE_0_SKILL_USAGE.md)
- [Tổng hợp](CASMS_MOBILE_PHASE_0_FINAL_SUMMARY.md)

Workspace có sẵn báo cáo và evidence từ lượt trước. Bộ 10 báo cáo yêu cầu đã được cập nhật theo lần rà soát này. Tệp bổ sung có sẵn được giữ nguyên; mã production, dependency, cấu hình phân quyền và database hiện hữu được giữ nguyên trong lần chạy này.
