# CASMS Mobile Phase C — UI_UX_REVIEW

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

File đọc: OceVie Mobile UX, constants/ocevie.ts, PassengerUI/Scaffold/Button/Sheet, PassengerActionUI và incumbent screens. File sửa UI theo IMPLEMENTATION. Không tạo UI library, token system hoặc motion mới; không sửa Web.

Hướng thiết kế: giữ pearl/navy/teal của OceVie, cỡ chữ/spacing có sẵn. Chuyến và hành khách trước danh mục; service → sheet detail/lịch/quyền lợi → confirmation; trạng thái yêu cầu và lịch sử tách bằng filter. Một primary action mỗi bước. Read-only package thay action quản lý draft. Không ảnh demo/counter giá giả/coin balance. Skeleton dùng semantic divider, không tạo dữ liệu giả.

Loading/empty/content/error/offline/disabled có copy; lỗi nghiệp vụ nói cách xử lý, không expose code nội bộ. ErrorNotice/live region, labeled numeric input, keyboard-aware Sheet và SafeArea kế thừa primitive; countdown/QR/NFC B không đổi. Giờ fallback UTC ghi rõ thay vì âm thầm giờ thiết bị. Null quota không thành 0. Biểu thị trạng thái bằng text, không chỉ màu.

Kiểm thử rendered dự kiến: services → search/category → detail → slot/request → My requests → edit/cancel; activities/tour → register → confirm/update/cancel; packages read. Browser plugin riêng và local Playwright/Puppeteer không cài. CUA IAB thử localhost và 127.0.0.1 đều ERR_CONNECTION_TIMED_OUT; native Brave bị công cụ từ chối vì chưa được cấp quyền. Không đổi firewall/network/security setting, không thêm browser dependency. Dev server/fixture được dừng sau thử nghiệm. Không có screenshot/DOM tương tác đủ điều kiện chứng minh UI pass.

Acceptance: source review STATIC_VERIFIED, rendered QA BLOCKED_BY_ENVIRONMENT; small-screen/tablet/font scaling/VoiceOver/TalkBack/Hardware Back/keyboard và native device chưa nghiệm thu. Fixture test source chỉ nằm tests, không production. Không tuyên bố UI_E2E hoặc DEVICE_E2E_PASSED.
