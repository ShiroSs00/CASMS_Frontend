# CASMS Mobile Phase G — DESIGN_SYSTEM

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Nguồn Mobile: src/constants/ocevie.ts; mapping passenger-light-theme.ts; docs/ocevie-mobile-ux.md. Đối chiếu canonical design-systems/ocevie/{DESIGN.md,tokens.css} nhưng không sửa Web/canonical CSS.

| Layer | Contract sau G | Consumers |
|---|---|---|
| Brand/semantic | Navy #0B2A4A primary/text, pearl #F8F6EC, teal #0E6B7A interaction, gold accent; status+text | Palette giữ |
| Boundary | controlBorder #718391 cho interactive input; border #D5E0E4/divider riêng | Login/Search/Input/Choice/POS Field |
| Typography | Existing typeScale; facts Body15/23; scalable text, không global font cap | Home + shared content |
| Spacing/radius | Existing spacing4…32; controls.touch48/radius14/card18/button52 | Scaffold/Button/Home/PosColumns |
| Widths | contentLayout passenger600/POS1120/form600/split840/pane320 | UI content/Scaffold/POS; phone single-column |
| Button | Existing filled/text/secondary/premium; disabled/loading/busy/pressed | Không tạo Button thứ ba |
| Field/choice/search | Visible label, disabled option guard, selected value accessible, input16 | Reuse hiện có |
| Sheet/modal | Existing PassengerSheet snapshot/close/pending/reduced motion; native backdrop hidden/keyboard/insets | Không tạo overlay library |
| Lists/status | InfoRow/PassengerListItem/EmptyState/ErrorNotice/Loading/QueryState/FilterChips | Notification FlatList vẫn dùng PassengerListItem |
| Tabs/nav | Existing5tabs + selected text/indicator; label wrap in tab | Không rewrite Router |
| Motion/shadow | Existing motion tokens/provider và reduced motion giữ | Không animate-ui Web vào native; không thêm animation |

Native system controls @expo/ui đã có nhưng G ưu tiên sửa incumbent primitives theo yêu cầu; không migrate control system chỉ vì skill gợi ý. Skill expo-ui/performance/accessibility riêng không có trong catalogue cài thực tế. Light/portrait là cấu hình hiện tại; không công bố dark theme/native landscape đã hỗ trợ. Các hardcoded legacy one-off còn lại được ghi maintenance; không refactor tất cả để giảm literal count hình thức.
