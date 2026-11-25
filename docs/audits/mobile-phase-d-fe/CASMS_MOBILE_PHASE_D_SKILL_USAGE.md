# CASMS Mobile Phase D — SKILL_USAGE

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, `main`, upstream `origin/main`, cộng working tree B/C. BE `0bc2b3831301a0d67d45bacc120a161dbacec026`; giữ `?? qa/` từ trước. Chỉ sửa Mobile/tài liệu, không Backend/DB/Web, SQL/seed/Maven/API mutation thật, commit/push hoặc dependency. Đã đối chiếu AGENTS/OceVie Mobile, báo cáo 0/A0/A/B/C và handoff trong cùng phiên. Contract STATIC_VERIFIED, chưa xác nhận deployment QA. Áp dụng 7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE. Kết quả kiểm tra cuối ở FE_REGRESSION.

Các skill đã được đọc trong cùng phiên trước khi áp dụng. Expo SDK58/RN0.88.1/React19.3 từ package đối chiếu docs v58 và llms index; dùng API hiện có, không nâng SDK.

| Skill | Áp dụng cụ thể |
|---|---|
| expo-native-ui | safe areas/native Stack, numeric keyboard, labels/insets, giữ B native NFC cancellation/lifecycle, không giả UID |
| expo-data-fetching | fresh preflight/context/statement, scoped query key, no mutation auto retry, GET/manual replay recovery, pending/error/unknown outcome |
| expo-router | staff route/session guard kế thừa; useFocusEffect bỏ late success, domain code ngoài route files |
| expo-design-system | OceVie constants/PassengerButton/Field/Notice/Sheet/ActionRow, không primitive/palette/library mới |
| ui-ux-pro-max | tìm targeted confirmation destructive action; ca làm việc/queue/primary CTA/status/unknown counts |
| impeccable | hierarchy, resilience, permission changes, receipt/status/empty/error, không gọi source review là rendered QA |
| frontend-design | ưu tiên thao tác nhân viên, bán mới khác fulfillment, account history rõ phạm vi, giữ ngôn ngữ thiết kế Mobile |
| frontend-testing-debugging | kiểm tooling và ADB target, unit/contract và export; ghi giới hạn rendered/native cùng runbook |

Skills ở C:/Users/quanh/.codex/skills/{skill}/SKILL.md; UI UX catalog repo/global đã đối chiếu. Không dùng animation skill Web cho React Native, không sửa hệ thống/hook để né blocker. Evidence trước/sau hiện là source/test, chưa có screenshot thực hợp lệ. Acceptance skill usage đạt; không biến skill compliance thành nghiệm thu Backend/device. Dependency mismatch cũ giữ ở backlog C.
