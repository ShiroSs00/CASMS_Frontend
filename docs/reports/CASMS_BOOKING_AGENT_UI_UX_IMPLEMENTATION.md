# Triển khai workspace Booking Agent

## Những thay đổi người dùng thấy

- `/admin/bookings` giữ chuyến, trạng thái và trang kết quả trong URL. Liên kết chi tiết mang theo ngữ cảnh để nút quay lại khôi phục bộ lọc. Desktop dùng bảng, màn hình hẹp dùng danh sách có nhãn cho ngày tạo, hành khách và giá.
- `/admin/bookings/new` hiển thị tàu, mã chuyến, mốc thời gian và sellability ngay ở bước chọn. Bước nhập hành khách có tóm tắt cabin/gói và nút bỏ hành khách bổ sung. Nút thêm điều hướng về bước chọn cabin cho người mới, giữ dữ liệu người đã nhập. Bước xem lại có báo giá từ BE, thời hạn và thông tin trả tiền nếu được cung cấp. Modal xác nhận đứng sau bước xem giá. Sau tạo hoặc recovery thành công có mã và nút mở hồ sơ.
- `/admin/bookings/lookup` hướng dẫn dùng liên hệ đã đăng ký, đưa focus về trường lỗi đầu tiên trong form và giữ input khi BE trả lỗi. Kết quả dùng cùng nhóm thông tin hồ sơ ở chế độ chỉ đọc. DTO chưa cung cấp định danh người đại diện nên không gắn nhãn đại diện vào một hành khách dựa trên thứ tự.
- `/admin/bookings/:bookingId` tách thông tin chuyến, hành khách, hợp đồng, thanh toán và nghiệp vụ. Hợp đồng được ghi nhận ngay trong mục hợp đồng. Xác nhận hiển thị số tiền đối soát, mức cọc và các điều kiện BE trả về. Dialog giữ nguyên khi BE từ chối vì thiếu cọc. Hủy cho thấy case đang ở đâu, trạng thái đặt chỗ được đọc lại từ BE. Đổi cabin có đối chiếu cabin hiện tại và cabin còn chỗ. Hành khách thuộc gói vé chỉ thấy giải thích về giới hạn.
- `/admin/bookings/cruises` dùng các hàng có tên chuyến, tàu, giờ đi/về, tình trạng và hành động phù hợp. Bộ lọc áp dụng trên sellability đã tải từ BE.

## File thay đổi

| Tệp trong Web Admin | Thay đổi |
| --- | --- |
| `src/features/booking/pages/RealBookingPages.tsx` | Bộ lọc trong URL, danh sách hẹp, tổ chức chi tiết và form tra cứu. |
| `src/features/booking/pages/RealBookingCreatePage.tsx` | Tóm tắt chuyến và hành khách, báo giá hiển thị trước xác nhận, kết quả tạo và recovery. |
| `src/features/booking/pages/BookingSaleCruises.tsx` | Danh sách chuyến đáp ứng chiều rộng và lọc sellability. |
| `src/features/booking/components/BookingRecord.tsx` | Component mới cho các nhóm thông tin chỉ đọc, badge trạng thái và số liệu thanh toán dùng chung. |
| `src/features/booking/components/BookingOperations.tsx` | Component mới đóng gói xác nhận, hủy legacy và đổi cabin, kiểm tra phản hồi trước khi thông báo thành công. |
| `src/features/booking/components/BookingContractAcceptance.tsx` | Biểu mẫu nằm trong mục Hợp đồng, có lỗi cạnh trường và dialog kiểm tra. |
| `src/features/booking/components/BookingInstallments.tsx` | Cho phép tắt bản tóm tắt hợp đồng đã hiển thị trong cùng hồ sơ. |
| `src/features/booking/components/LiveBookingFields.tsx` | Tóm tắt lựa chọn, thêm/bỏ hành khách ở bước 2 và làm mới lỗi khi sửa trường. |
| `src/features/booking/components/BookingAgent.module.css` | Bố cục theo breakpoint, khoảng cách và trạng thái focus dùng hệ token OceVie. |
| `src/features/booking/api/real-booking-api.ts` và `src/features/booking/model/real-booking-view.ts` | Đọc số boong đã có trong DTO và thống nhất nhãn hợp đồng. |
| `src/shared/cancellation/CancellationCases.tsx` | Kiểm tra lý do và hiển thị tác động trên nhánh dialog dùng trong workspace đặt chỗ. |

## Thiết kế và kiểm tra

- Impeccable ở chế độ Operate định hướng nhóm thông tin task-first, mật độ vừa phải và responsive theo cấu trúc. Kết hợp hướng dẫn frontend-design để giảm phần mô tả lặp và đặt động từ thao tác theo kết quả.
- UI/UX Pro Max hỗ trợ chọn bố cục danh sách thích ứng, lỗi cạnh trường, focus có thể thấy và thao tác bàn phím. Sử dụng `PageHeader`, `Panel`, `RecordFacts`, `Field`, `Button`, `Badge`, `DataTable`, `Modal` và các token có sẵn. Phạm vi CSS nằm trong feature.
- Frontend Testing Debugging được áp dụng cho kiểm thử trình duyệt và đối chiếu ảnh thật. Dữ liệu, giới hạn và kết quả chi tiết có trong [báo cáo trình duyệt](CASMS_BOOKING_AGENT_UI_UX_BROWSER_E2E.md).
- Thay đổi UX tự chọn gồm URL dùng số trang bắt đầu từ 1, mobile trình bày dạng danh sách, báo giá trên bước xem lại và quay về bước chọn cabin khi thêm người. Backend vẫn quyết định phân công, điều kiện thương mại, khả dụng và kết quả mutation.
