# CASMS Mobile Phase B — SKILL_USAGE

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đã đọc và áp dụng các SKILL.md cài tại `C:/Users/quanh/.codex/skills/` (ui-ux-pro-max có bản trong `.agents/skills`):

| Skill | Áp dụng cụ thể |
|---|---|
| expo-native-ui | Camera permission, AppState/focus, native device states, no Expo Go NFC |
| expo-data-fetching | Scoped client, Zod response, no auto POST replay, recheck GET/lookup, late-result guard |
| expo-router | Route giữ Expo Router, scope remount, focus cleanup, không đặt utility trong app/ |
| expo-design-system | OceVie tokens và Button/Scaffold/Sheet/Notice hiện có |
| ui-ux-pro-max | Hiển thị identity đúng lúc, label, tap targets và hướng dẫn điều kiện |
| impeccable | Audit native state, sensitive payload, hierarchy và edge cases |
| frontend-design | Bố cục identity → QR/trạng thái → action, text trạng thái rõ |

Đã đối chiếu Expo SDK58 docs và source package NFC version pin. Không dùng animation skill vì không có motion mới. File thay đổi theo IMPLEMENTATION; test evidence theo FE_REGRESSION. Skill usage STATIC_VERIFIED, không thay cho device QA.
