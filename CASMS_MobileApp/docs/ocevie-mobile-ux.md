# OceVie Mobile

Nền tảng dùng logo OceVie, màu pearl/navy/teal/gold, token trong `src/constants/ocevie.ts` và các primitive Passenger hiện có. Scaffold dùng safe area. Sheet xử lý keyboard, khóa thao tác khi pending và theo tùy chọn giảm chuyển động cấp hệ thống.

| Tab Passenger | Route | Mục đích |
|---|---|---|
| Trang chủ | `/home` | Chuyến hiện tại và lối tắt |
| Lịch trình | `/itinerary` | Ngày, cảng, hoạt động và thay đổi |
| Dịch vụ | `/services` | Danh mục và yêu cầu trên tàu |
| Thông báo | `/notifications` | Danh sách, chi tiết và trạng thái đã đọc |
| Tài khoản | `/account` | Ngữ cảnh phiên, đặt chỗ đã có, hoạt động/gói và hỗ trợ |

`/passenger-bookings` và chi tiết là màn companion. `/bookings` và `/passenger-bookings/new` chuyển về danh sách, `/explore` chuyển về dịch vụ. `/cruise` đọc thông tin chuyến đã chọn. Check-in, hướng dẫn thẻ và hướng dẫn sao kê là màn riêng. POS dùng điều hướng và phiên scoped riêng.

Hiển thị loading khi đang xác minh, trạng thái rỗng khi dữ liệu đã tải, phản hồi lỗi có hành động tải lại và hướng dẫn khi cấu hình thiếu. Chi tiết đặt chỗ giữ trạng thái và lý do Backend trả, cùng hướng dẫn liên hệ nhân viên khi người dùng cần hủy. Xem [Passenger API](passenger-live-api.md) và [Staff POS](onboard-staff-pos.md).

## Component contract sau Phase G

- Dùng một nguồn token `src/constants/ocevie.ts`. Viền control dùng `lightTheme.controlBorder` (#718391 theo OceVie); `border`/`divider` dành cho phân cách nội dung. Focus dùng teal, trạng thái luôn có nhãn bên cạnh màu.
- Giữ PassengerButton (filled/secondary/text/premium), OutlinedField, PassengerUI, InfoRow và PassengerSheet. Không tạo thêm Button/Modal/Sheet system. Touch target tối thiểu48, text được scale theo hệ thống; container dùng minHeight/padding thay vì khóa chiều cao chữ.
- Search giữ label nhìn thấy khi đã nhập. Choice đọc cả nhãn và lựa chọn hiện tại; khi disabled, cả trigger và options của sheet đang mở phải khóa. Loading có label/busy; empty chỉ sau read thành công, paused có hướng dẫn kết nối riêng. Không suy query disabled thành đang fetch hoặc dữ liệu rỗng.
- Passenger nội dung tối đa600; POS Dashboard/Requests có thể mở tới1120. `PosColumns` dùng available width/fontScale với ngưỡng840, không suy thiết bị theo tên. Phone/chữ lớn trở về một cột; form sale/statement/scanner vẫn bounded600. Giữ context trước action, detail trước confirmation.
- Notification Center dùng FlatList làm scroll owner, PassengerListItem và UUID key; LivePage scroll=false chỉ khi con đã sở hữu scroll. Không lồng virtualized list trong ScrollView; không giả pagination khi Backend chưa hỗ trợ.
- Sheet giữ close/pending lock, snapshot lúc exit và reduced motion hiện có; scrim không là focus target. KeyboardAvoidingView và safe area là source safeguards, vẫn phải kiểm bằng runtime Android/iOS.
- Không sửa operation journal hoặc tự replay mutation để làm UI có vẻ thành công. Unknown amount/quota không thành0, currency/đơn vị theo server, ticket payment khác onboard statement/Folio.
- Display clock dừng background/inactive, cập nhật ngay khi active. Expiry/preflight dùng thời gian thực và Backend; không dựa nhãn đếm ngược để cho phép mutation.

Native app hiện khai báo light/portrait. Phase G mới STATIC_VERIFIED; chưa nghiệm thu rendered phone/tablet, keyboard/Back, TalkBack/VoiceOver hay FPS/memory. Tham chiếu bộ báo cáo `docs/audits/mobile-phase-g-fe/` ở repository root trước khi nghiệm thu hoặc mở thêm native build scope.
