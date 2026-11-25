# CASMS Mobile Phase G — PASSENGER_UI_UX_IMPLEMENTATION

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Giữ5 tab Trang chủ/Lịch trình/Dịch vụ/Thông báo/Tài khoản và route behavior A0/A. Passenger nội dung tối đa600px; facts dùng typeScale.body, time column không khóa46px. Shared controlBorder lấy canonical OceVie, search giữ label khi nhập; Choice thông báo giá trị và ngăn option thay đổi khi bị disable. Button không đổi animation/behavior.

LivePage thêm scroll=false chỉ cho notification FlatList; default=true bảo toàn toàn consumer Services/Activities/Check-in/Bookings/Spending/Account. FlatList giữ list header (count/status/actions/loading/empty/error), item UUID, sheet detail ngoài list. Một scroll owner, không FlatList lồng ScrollView. Không tạo pagination khi API chưa hỗ trợ.

Check-in/booking/payment detail/ship metadata/decks và registrations/request loading dùng isLoading; paused có hướng dẫn, empty booking chỉ khi isSuccess. Không chuyển unknown thành0. Sheet giữ snapshot khi exit và khóa dismiss pending; thêm keyboard/inset native source safeguards.

Service Hub → detail → schedule → confirm → result → My Requests, Activity → register → confirm → My Registrations vẫn dùng cùng mutation/preflight/journal từ C. QR claim/quiet zone/expiry/renewal và account logout confirm giữ. Chỉ display clock được pause background, resume tick ngay; mọi write guard vẫn dùng actual Date.now/server.

Không mở thêm chức năng chưa có contract: booking mới, activation, Folio/settlement, ACK, push, renderer3D, support chat/ticket. Audit/test evidence cụ thể theo G-01…09 trong FE_IMPLEMENTATION. Navigation/keyboard/hardware Back chưa rendered verify.
