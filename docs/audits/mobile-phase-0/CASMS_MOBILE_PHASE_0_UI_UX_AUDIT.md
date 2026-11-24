# Audit Mobile UI/UX

Ngày rà soát 24/11/2026. FE HEAD 3c01db0 và BE HEAD 0bc2b38, xác minh trực tiếp trong workspace.

Kết luận ghi theo source hoặc mức bằng chứng trong [Báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md). Dấu vết có sẵn được phân biệt với lần chạy hiện tại.

## Đánh giá từ source

OceVie Mobile dùng `docs/ocevie-mobile-ux.md`, `constants/ocevie.ts`, passenger light/dark theme, PassengerButton/Field/Sheet/Scaffold. Tài liệu Mobile cũ còn mô tả bottom navigation Đặt chỗ ở giữa, nhưng source hiện dùng Home/Itinerary/Services/Notifications/Account. Cần cập nhật mô tả sau khi chốt phạm vi.

Passenger có task theo chuyến, cabin, service và notifications, không dùng bảng quản trị dày đặc ở Home. POS có context ca làm việc, danh mục/yêu cầu/hoạt động/hạn mức. Hai trải nghiệm đã tách screen nhưng chia sẻ scaffold/primitive.

Scaffold dùng safe-area-context, icon buttons 48, labels có accessibilityRole/Label. PassengerButton có disabled/busy/loading, text wrap và minHeight từ controls. LivePage có loading/error/empty/permission state, refresh và keyboardShouldPersistTaps=handled. Sheet và motion provider hỗ trợ giảm chuyển động. Chưa xác nhận focus order, keyboard dismissal, hardware back, TalkBack/VoiceOver trên thiết bị.

| Chiều kiểm tra Impeccable native | Kết quả source | Bằng chứng/việc còn lại |
|---|---|---|
| Accessibility | Có labels/role/state, chưa chấm điểm thiết bị | Test lớn chữ, đọc màn hình, contrast composed |
| Performance | Inbox map/ScrollView, bundle web common 1.7MB | M10, đo startup/scroll release native |
| Appearance | Semantic palette có, literal radius/ripple vẫn có | M12, kiểm contrast và token drift |
| Platform conformance | Custom header/nav, light-only app config | Nghiệm thu gestures, Android/iOS riêng |
| Adaptivity | Portrait lock, header 600 maxWidth | M11, test POS tablet |

Không gán health score tổng từ source vì chưa có render native/device đủ bằng chứng. Màn Splash/Login/Home/Itinerary/Services/Activities/Packages/Notifications/Account/QR/Spending/Support đã kiểm kê. POS terminal/session/dashboard/catalog/requests/activities/scanner/usage có source. Thẻ QR và Chi tiêu đang là hướng dẫn tại quầy. Chưa có screenshot native trong audit.

Các width acceptance cần chạy 375dp, phone lớn, tablet 768/1024dp, font lớn nhất, keyboard mở, mất mạng, mutation timeout, pending dismissal và reduced motion. Phase 0 chưa thay UI.

## M10 — Danh sách dài (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/notifications/PassengerNotificationsScreen.tsx:41` |
| Class/function | `inbox.data?.map` |
| Kỳ vọng | Inbox lớn có virtualization hoặc pagination. |
| Thực tế | Render tất cả bằng map trong LivePage ScrollView. |
| Nguyên nhân | Danh sách không giới hạn trong screen. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase G |
| Khuyến nghị | Dùng list có virtualization và API pagination nếu cần. |
| Acceptance criteria | Đo scroll 1000 thông báo trên thiết bị, không mất focus hoặc trạng thái đọc. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M11 — Staff tablet (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/app.json:6` |
| Class/function | `"orientation"` |
| Kỳ vọng | POS có trải nghiệm phù hợp tablet và cửa sổ khác kích thước. |
| Thực tế | Toàn app khóa portrait, scaffold header maxWidth 600 và layout chủ yếu một cột. |
| Nguyên nhân | Thiết kế phone chung cho hai đối tượng. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase G |
| Khuyến nghị | Nghiệm thu tablet rồi quyết định adaptive layout cho POS. |
| Acceptance criteria | Tablet portrait/landscape/multiwindow đọc và thao tác được, keyboard không che CTA. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |

## M12 — Token và primitive (P2)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/components/passenger/PassengerButton.tsx:23` |
| Class/function | `borderRadius: 14` |
| Kỳ vọng | Giá trị primitive theo token Mobile đã thống nhất. |
| Thực tế | Radius 14 lặp inline/stylesheet, ripple literal, nhiều theme files. |
| Nguyên nhân | Token Mobile chưa bao phủ đầy đủ primitive. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | FIX, Phase G |
| Khuyến nghị | Hợp nhất semantic mapping trong OceVie Mobile, giữ API component. |
| Acceptance criteria | Button/Field/Sheet dùng token, kiểm contrast/disabled/text scaling thực tế. |
| Test status | STATIC_VERIFIED, xem TEST_REPORT cho runtime |


## Kiểm tra theo bối cảnh sử dụng

| Bối cảnh | Bằng chứng source | Nghiệm thu còn thiếu |
|---|---|---|
| Passenger điều hướng | `PassengerNavigation.tsx` dùng label, trạng thái chọn và tab có chức năng phân biệt. Root guard tách Staff POS. | Trở về từ deep link, giữ ngữ cảnh tab sau modal, nút Back Android và edge swipe iOS. |
| Thao tác và chữ | `PassengerButton.tsx`, `OutlinedField.tsx`, `PassengerListItem.tsx` gom style và accessibility. `constants/ocevie.ts` và theme Passenger dùng palette thương hiệu. | Đo size thực >=44pt iOS/48dp Android và contrast text >=4.5:1 trên nền thực. Test tiếng Việt và font scale lớn. |
| Sheet và keyboard | `PassengerSheet.tsx` có onRequestClose, nội dung scroll, vùng keyboard/safe area và lock khi pending. | Kiểm focus ban đầu, trả focus khi đóng, TalkBack/VoiceOver, IME che action và hardware Back trong sheet lồng. |
| Loading, empty, error, offline | Scaffold/ActionUI hiển thị feedback. POS phân biệt phiên hết và sale chưa rõ trạng thái. | QA không mạng từ cold start, nền → active, trạng thái tạm không có dữ liệu, trùng thao tác sau reconnect. |
| Motion | `useMotionPreference.ts`, sheet-presence và launch indicator dùng reduced motion và lifecycle. | Test máy bật giảm chuyển động, interrupted transition và frame time khi camera chạy. |
| POS phone nhỏ và tablet | `app.json` khóa portrait, `PosLayout` dùng scaffold và điều hướng thao tác. | Máy 320–375dp, tablet portrait/landscape và chia cửa sổ. Cần kiểm CTA camera, bàn phím và dữ liệu tiền dài. |
| Hiệu năng danh sách | Các màn dùng Scaffold dạng scroll, render nhiều item theo dữ liệu; chưa có số frame, memory hoặc thời gian mở màn. | Dùng dataset QA dung lượng vận hành, đo ngưỡng để chọn phân trang hoặc virtualization. |

Mức đánh giá là audit source theo OceVie Mobile và kỹ thuật native. Chưa có điểm tổng hợp từ thiết bị hoặc xác nhận visual parity.

## Đo contrast ở cấp token

Cặp `navy` trên `pearl` đạt 13.42:1, `textSecondary` trên `pearl` đạt 5.46:1 và `teal` trên nền trắng đạt 6.17:1. Tính từ sRGB tại `CASMS_MobileApp/src/constants/ocevie.ts:2–19`. Các cặp này đạt mức text thường. Cần xác minh alpha, nền ảnh và trạng thái tương tác từ màn render. `app.json` khóa chế độ sáng.
