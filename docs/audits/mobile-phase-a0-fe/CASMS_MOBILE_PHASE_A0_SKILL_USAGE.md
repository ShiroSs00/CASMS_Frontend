# Skills A0-FE

Baseline FE `3c01db0`, BE `0bc2b38` trên `main`. Remote GitHub xác nhận cùng HEAD.

Đã đối chiếu AGENTS gốc/Mobile, `docs/ocevie-mobile-ux.md`, các báo cáo Phase 0, tài liệu Expo SDK 58 và các skill dưới đây. Các tệp kỹ thuật thay đổi và evidence nằm trong [triển khai](CASMS_MOBILE_PHASE_A0_FE_IMPLEMENTATION.md) và [regression](CASMS_MOBILE_PHASE_A0_FE_REGRESSION.md).

| Skill | Đường dẫn thực tế | Áp dụng và trước → sau |
|---|---|---|
| expo-data-fetching | `~/.codex/skills/expo-data-fetching/SKILL.md` | Tái sử dụng api-client, phân biệt abort/timeout/quyền, giữ mutation idempotency và state dùng TanStack Query. |
| expo-router | `~/.codex/skills/expo-router/SKILL.md` | Đọc root/Passenger/POS guards, giữ deep link alias đã có, không rewrite navigation khi chỉ cần bảo vệ config và session. |
| expo-design-system | `~/.codex/skills/expo-design-system/SKILL.md` | Tái sử dụng Scaffold/EmptyState và semantic style hiện có cho root error và state trống. |
| expo-native-ui | `~/.codex/skills/expo-native-ui/SKILL.md` | Safe area qua scaffold, nội dung cuộn, thông báo lỗi selectable, giữ trải nghiệm keyboard/sheet. |
| ui-ux-pro-max | `.agents/skills/ui-ux-pro-max/SKILL.md` | Hướng dẫn phân cấp nội dung khi thay CTA hủy bằng hướng dẫn và message retry, dùng components hiện có. |
| impeccable | `~/.codex/skills/impeccable/SKILL.md`, `reference/audit.native.md` | Rà các trạng thái người dùng ở mức source, giữ accessibility role và clear feedback, không áp dụng redesign. |
| frontend-design | `~/.codex/skills/frontend-design/SKILL.md` | Viết chỉ dẫn ngắn, có tác nhân liên hệ, dùng ngữ cảnh hành khách và palette hiện có. |

Các nguyên tắc xử lý nguyên nhân trực tiếp đã áp dụng vào code và test. Không có dependency mới. Phần xác minh runtime còn là QA thật và thiết bị, vì thế chưa xác nhận hardware Back, màn lỗi hoặc typography trên thiết bị. [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Protected routes](https://docs.expo.dev/router/advanced/protected/), [Expo Env](https://docs.expo.dev/guides/environment-variables/).
