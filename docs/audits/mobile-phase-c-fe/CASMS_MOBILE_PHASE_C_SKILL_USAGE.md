# CASMS Mobile Phase C — SKILL_USAGE

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`, cộng working tree Phase B chưa commit. BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. Baseline 130 tests, TypeScript/lint/export pass, Doctor 19/20. Giữ nguyên thay đổi B và các tệp untracked cũ. Không sửa Backend/DB/Web, không chạy Maven/SQL/seed/migration hoặc API mutation thật; không commit/push, không nâng dependency.

Đối chiếu báo cáo Phase 0/A0/A/B và handoff trong cùng phiên làm việc. Contract được xác minh từ source, chưa phải deployment QA. Các trường hợp nullable đối chiếu cả `application.yml` với `default-property-inclusion: non_null`: trường null có thể bị bỏ khỏi JSON, FE normalize thành null và không coi là 0.

Skill áp dụng: expo-native-ui, expo-data-fetching, expo-router, expo-design-system, ui-ux-pro-max, impeccable, frontend-design. Xem [SKILL_USAGE](CASMS_MOBILE_PHASE_C_SKILL_USAGE.md). Kết quả cuối ở [FE_REGRESSION](CASMS_MOBILE_PHASE_C_FE_REGRESSION.md); acceptance không bao gồm REAL_API_PASSED hoặc DEVICE_E2E_PASSED.

Đã đọc các SKILL.md cài đặt và áp dụng theo scope C. Không dùng animation skill Web hoặc tạo design system mới.

| Skill | Evidence áp dụng |
|---|---|
| expo-native-ui | Native Sheet/form/numeric keyboard/safe-area, permission kế thừa, trạng thái offline rõ; không biến NFC B thành gate tiện ích |
| expo-data-fetching | Scoped keys, AbortSignal GET, Zod, readonly projection, pre-write refresh, no auto POST retry, operation recovery và epoch guard |
| expo-router | Giữ route services/passenger-services/activities/packages, remount workspace theo context; utility nằm ngoài src/app |
| expo-design-system | OceVie tokens, PassengerScaffold/Button/Sheet/Choice/ErrorNotice/FilterChips hiện có, không primitive thứ ba |
| ui-ux-pro-max | Đã search local UX error recovery/confirmation và react-native accessibility/keyboard; kết quả match đúng query, không persist generated palette |
| impeccable | Chạy context --target màn Services; scoped task dùng code và OceVie Mobile hiện có, đọc craft-floor trước UI edit; không sửa hook/system setup |
| frontend-design | Hierarchy context→catalogue→detail→confirmation→history, copy theo nghiệp vụ, không hero/decorative default |

Nguồn framework: [SDK58](https://docs.expo.dev/versions/v58.0.0/), [Expo docs index](https://docs.expo.dev/llms.txt), source installed Expo/RN/TanStack hiện hành. Không nâng SDK/RN.

Đọc thêm frontend-testing-debugging để kiểm tra rendered loop: Browser plugin không có trong catalog, local Playwright không có; thử CUA IAB/native browser nhưng bị environment/access block. Ghi nguyên nhân thay vì install dependency ngoài scope hoặc tuyên bố screenshot pass. Skill usage STATIC_VERIFIED, không thay cho device QA.
