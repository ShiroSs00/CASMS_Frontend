# CASMS Mobile Phase G — STAFF_POS_UI_UX_IMPLEMENTATION

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Chỉ sửa PosDashboard.tsx, PosServices.tsx (phần composition của PosRequests), pos-ui.tsx và thêm pos-layout-metrics.ts. Shared Passenger primitives phục vụ cả POS cũng được harden. Không sửa PosLayout/session transport/storage/scope/lifecycle, PosUsage sale/recovery, scanner/NFC API.

PosPage wide là opt-in cho Dashboard và Requests, max1120; các form/statement/scanner/activities giữ600. PosColumns dựa useWindowDimensions và effective width/fontScale, split840; phone320–430, tablet768 hoặc chữ lớn vẫn một cột; width1024/1280 đủ điều kiện có hai pane. Request không có action được cấp quyền sẽ không tạo pane action rỗng. Thứ tự đọc vẫn context trước work, detail trước action, phone không mất chức năng.

PosPage có KeyboardAvoidingView theo platform và ScrollView insets/taps handled. Field có contrast boundary đủ3:1. Request context hiển thị terminal name/user; exact BP/schedule/service vẫn hiện trước thao tác. Các action guards, confirmations, entitlement, full fulfillment, journal, same-key replay và Date.now preflight giữ nguyên.

Không có native tablet portrait/landscape screenshots. Landscape native N/A (portrait config); multi-window logic unit pass không thay thế render. Không master-detail route mới, permission workaround hoặc API mới.
