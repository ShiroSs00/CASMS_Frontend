# CASMS Mobile E0 — SKILL_USAGE

Ngày 25/11/2026. FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, main, origin/main + working tree B/C/D được giữ nguyên; BE `0bc2b3831301a0d67d45bacc120a161dbacec026`, chỉ đọc, giữ ?? qa/ cũ. Baseline D:164 tests, typecheck/lint/export pass, Doctor19/20. Đã đối chiếu AGENTS gốc/Mobile, OceVie Mobile, báo cáo0/A0/A/B/C/D và handoff. E0 không sửa Backend/DB/Web, không SQL/seed/migration/Maven/API write thật, dependency, commit/push. Contract STATIC_VERIFIED từ source, chưa QA. Áp dụng7 skill bắt buộc và frontend-testing-debugging; xem SKILL_USAGE.

Đã đọc và tái sử dụng hướng dẫn skill trong cùng phiên, đối chiếu AGENTS/OceVie Mobile và tài liệu Expo SDK58/versioned docs + llms index đã đọc ở các phase trước. Không nâng SDK hoặc thay pattern native bằng animation Web.

| Skill | Áp dụng E0 |
|---|---|
| expo-native-ui | reuse Scaffold/LivePage, native Stack, safe area, readable EmptyState/Loading, font/token hiện có; không dựng dashboard tài chính giả |
| expo-data-fetching | financial APIs blocked, chỉ confirmed Voyage Context; nullable khác zero, unknown khác empty, query permission/owner/epoch/API kế thừa; không local financial cache |
| expo-router | route spending re-export screen, router links đặt chỗ/quyền lợi/hỗ trợ; không settlement route/CTA |
| expo-design-system | PassengerButton/EmptyState/ui/OceVie; không primitive/palette/dependency thứ hai |
| ui-ux-pro-max | targeted search “empty data state”: kết quả Empty States phù hợp All platforms, dùng thông điệp hướng dẫn và next action; bỏ các kết quả Web bulk/video không liên quan |
| impeccable | resilience/clarity: no stale voyage label khi refetch/error, unavailable không false missing account, ended không paid; copy phân biệt limit/payment/quota |
| frontend-design | giữ màn hướng dẫn tối giản, ưu tiên xem/chọn chuyến, không thẻ số liệu trang trí; đồng bộ ngôn ngữ OceVie |
| frontend-testing-debugging | tests formatter/state/architecture, full regression/export; ghi rendered/device chưa nghiệm thu và không cài tool để bypass môi trường |

Skill files nằm ở C:/Users/quanh/.codex/skills/{skill}/SKILL.md và catalog repo UI UX. Source sửa/contract/root cause ở FINANCIAL_FOUNDATION/SPENDING_UI/API_CONTRACT; test evidence FE_REGRESSION. Không thêm formatter currency thứ hai cho Spending, mở rộng helper hiện có có signed opt-in. Acceptance skill usage hoàn tất; không suy ra REAL_API/DEVICE pass từ việc áp dụng skill.
