# CASMS Mobile Phase G — ACCESSIBILITY

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Đây là static review, không TalkBack/VoiceOver certification. Native accessibilityLabel/Role/State được dùng; không chuyển Web ARIA thành native solution.

| Hạng mục | Evidence / action | Gate |
|---|---|---|
| Controls | Button busy/disabled labels vốn có; password visibility thêm disabled state; Choice nêu selected value + disabled options | STATIC_VERIFIED |
| Icons | MaterialIcon decorative có native accessible=false/elementsHidden/no-hide-descendants | STATIC_VERIFIED; SR traversal pending |
| Modal | Backdrop không còn duplicate focus target; Close48px; onRequestClose và pending guard giữ | STATIC_VERIFIED; focus restore/trap/escape native pending |
| Text scaling | Không tắt allowFontScaling; tab labels maxWidth; Home time intrinsic; effective-width POS split | Logic unit pass; large font render pending |
| Contrast | Navy/teal/secondary/placeholder trên white/pearl; controlBorder>=3, body>=4.5 | Calculated unit pass; toàn pixel screenshot chưa kiểm |
| Touch | Existing touch48/button52, row60+, Close/eye48 | Static; clipped hit areas/device touch pending |
| Loading/error | Loading accessible busy + label; errors selectable/alert; paused states text riêng | Source; announcements timing pending |
| Color-only | Status/unread/connection có text, tab selected state và marker | Source; không kết luận mọi Backend enum mới đã mapping |
| Keyboard | Existing login KAV, shared sheet/POS KAV + scroll handled; no auto new keyboard library | Render pending Android/iOS/Web |
| Reduced motion | Existing provider một OS listener, sheet/button/launch respect reduced; không thêm motion | Source + existing tests; OS toggle pending |
| Reading order | Dashboard context→work, request details→actions; small width vertical | Source; SR native pending |

Manual matrix khi Phase M có build: Login/failure/retry; request invalid qty/failed-save/busy picker; registration; emergency contact; QR expiry/renewal; notification read/read-all/detail; sale/receipt/recovery/fulfillment; sheet Back/Close/focus-return; 200% text và phone/tablet. Không chụp claim/UID/JWT hoặc dữ liệu khách thật.
