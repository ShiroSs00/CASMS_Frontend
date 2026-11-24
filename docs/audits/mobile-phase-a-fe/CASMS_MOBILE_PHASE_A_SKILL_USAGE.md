# Skills Phase A-FE

Baseline ngày 24/11/2026. FE `3c01db0412e29486ac750b0ebbcd090c6bed0353` cộng toàn bộ working tree A0-FE chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Local `main`, upstream tracking và remote GitHub trùng hai commit.

Đã đọc AGENTS của repo/Mobile, OceVie Mobile, tài liệu Expo SDK 58 và các SKILL.md. Các file đọc/sửa theo chức năng ở [triển khai](CASMS_MOBILE_PHASE_A_FE_IMPLEMENTATION.md). Vấn đề gốc gồm auth role/restore thiếu nhánh rõ, selection đồng hạng và sự khác biệt DTO/copy từ Backend.

| Skill | Đường dẫn | Áp dụng thực tế |
|---|---|---|
| expo-native-ui | `C:/Users/quanh/.codex/skills/expo-native-ui/SKILL.md` | Giữ safe areas, login keyboard, loading/retry/empty, chọn chuyến qua sheet hiện có. |
| expo-data-fetching | `C:/Users/quanh/.codex/skills/expo-data-fetching/SKILL.md` | Validate DTO, query keys theo owner/epoch/context, retry tường minh và đọc dữ liệu thật. |
| expo-router | `C:/Users/quanh/.codex/skills/expo-router/SKILL.md` | Guard guest/role, continue deep link đã kiểm, thay entry bằng redirect khi auth xong. |
| expo-design-system | `C:/Users/quanh/.codex/skills/expo-design-system/SKILL.md` | Token OceVie, tái sử dụng Scaffold, Button, InfoRow, ErrorNotice, Sheet. |
| ui-ux-pro-max | `.agents/skills/ui-ux-pro-max/SKILL.md` | Cột thông tin, touch target sẵn có, label và trạng thái selected. |
| impeccable | `C:/Users/quanh/.codex/skills/impeccable/SKILL.md`, `reference/audit.native.md` | Rà a11y/typography, adaptivity, giảm chuyển động và cadence cập nhật. |
| frontend-design | `C:/Users/quanh/.codex/skills/frontend-design/SKILL.md` | Ưu tiên chuyến/cabin trước shortcut, copy có tác vụ, loại tên tàu mặc định khỏi dữ liệu hành khách. |

Evidence trước/sau và blocker nằm trong [UI/UX review](CASMS_MOBILE_PHASE_A_UI_UX_REVIEW.md) và [kiểm hồi quy](CASMS_MOBILE_PHASE_A_FE_REGRESSION.md). Acceptance ở mức FE; chưa có native runtime và QA thật. [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected/).
