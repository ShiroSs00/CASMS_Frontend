# Skills và tài liệu đã dùng

Rà soát ngày 24/11/2026 trên FE `3c01db0` và BE `0bc2b38`. Đã đọc `AGENTS.md` gốc và `CASMS_MobileApp/AGENTS.md`, xác định skill workspace từ `.agents/skills`, skill global từ `~/.codex/skills` và `~/.agents/skills`.

| Skill thực tế | Nơi đọc | Áp dụng |
|---|---|---|
| `expo-native-ui` | `~/.codex/skills/expo-native-ui/SKILL.md` | Scaffold, camera UX, insets, keyboard, touch target, font lớn, hành vi native và tablet. Xem UI_UX_AUDIT và STAFF_POS_AUDIT. |
| `expo-data-fetching` | `~/.codex/skills/expo-data-fetching/SKILL.md` | API transport, envelope, TanStack Query, retry, context owner, loading/error/empty và mất mạng. Xem FE_AUDIT và API_CONTRACT_MATRIX. |
| `expo-router` | `~/.codex/skills/expo-router/SKILL.md` | File routes, root guard, passenger/pos layout, restore và route legacy. Xem FE_AUDIT. |
| `expo-design-system` | `~/.codex/skills/expo-design-system/SKILL.md` | Đối chiếu token OceVie, semantic roles và primitive hiện có. Xem UI_UX_AUDIT. |
| `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` và `references/pro-rules.md` | Phân cấp action, touch target, contrast, vai trò accessibility và kiểm thiết bị nhỏ. Dùng bản workspace. |
| `impeccable` | `~/.codex/skills/impeccable/SKILL.md`, `reference/audit.native.md`, mục iOS/Android | Audit source về accessibility, performance, conformance và adaptivity. Điểm số và xác nhận hành vi chờ runtime thiết bị. |
| `frontend-design` | `~/.codex/skills/frontend-design/SKILL.md` | Tham chiếu hierarchy, độ dài dòng và giảm chi tiết trang trí khi rà UX. Không có công việc redesign trong Phase 0. |

Tên skill riêng cho **Expo Development Client, React Native Best Practices, Expo SDK Compatibility, Expo Deployment, Spring Boot, PostgreSQL, Integration Testing và E2E Testing** không xuất hiện trong danh mục đã kiểm tra. Dùng tài liệu Expo chính thức cho development build/camera/SDK/deployment và dùng Maven, PostgreSQL/Flyway, harness repo để kiểm tra hành vi Backend. `animate-ui` có cài cho React/Vue web. Motion hiện tại được audit từ source React Native và các test sẵn có. Phase 0 không cài skill/dependency mới.

- SDK 58 ghép RN 0.88, React 19.3 và Node tối thiểu 22.13.x. Đối chiếu `package.json` và test trên Node 24.18. [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Changelog SDK 58](https://expo.dev/changelog/sdk-58).
- Camera SDK 58 hỗ trợ Expo Go tương thích. NFC hoặc native lib riêng đòi hỏi binary development cùng config và quyền theo platform. [Expo Camera SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/camera/), [Development builds](https://docs.expo.dev/develop/development-builds/introduction/).
- Expo Build tạo bản binary cho internal QA, signing thiết bị vật lý theo platform. Expo export dùng để kiểm bundle. [Expo Build](https://docs.expo.dev/build/introduction/), [Expo documentation index](https://docs.expo.dev/llms.txt).

Nguồn OceVie Mobile là `CASMS_MobileApp/docs/ocevie-mobile-ux.md`, `src/constants/ocevie.ts`, các theme Passenger và primitive. `design-systems/ocevie/DESIGN.md` áp dụng cho Web, được dùng để đối chiếu ngôn ngữ thiết kế chung.
