# Audit Staff POS và QR/NFC

Ngày rà soát 24/11/2026. FE HEAD 3c01db0 và BE HEAD 0bc2b38, xác minh trực tiếp trong workspace.

Kết luận ghi theo source hoặc mức bằng chứng trong [Báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md). Dấu vết có sẵn được phân biệt với lần chạy hiện tại.

## Operations

PosLayout và pos-access xác minh employee role, /auth/me ACTIVE/POS_ACCESS, token thiết bị riêng và terminal context. Device POS-only không được xem như employee. pos-transport đính X-POS-Session vào /pos, parse Zod response. PosDashboard điều hướng theo permissions. PosServices có request actions, PosActivities có registration/attendance, PosUsage có sale/statement. Đây là tích hợp API thật trong source.

pos-storage bind owner/signedInAt/backend, lưu SecureStore, cleanup session khi logout. Pending-sale journal khóa theo terminal, giữ key khi outcome chưa rõ. pos-lifecycle kiểm fulfillment quantity/unit và action theo trạng thái hoạt động. Backend PosService.access đọc lại revocation/assignment sau lock. Sale idempotency và ledger locks đã có, chưa có bằng chứng concurrent real API trong lần audit.

## Native reference

`CASMS_Backend/ios/PassengerCardPOS` có .xcodeproj, SwiftUI entry, CardReader.swift/CoreNFC, ClaimScanner.swift, CustomerCheckinView.swift, POSAPI.swift và entitlement. Có thể mở như app iOS độc lập trên macOS/Xcode, còn cần signing/provisioning và iPhone thật. Chưa build trong môi trường Windows này.

CardReader đọc UID 4–32 byte hex qua iso14443/iso15693, hỗ trợ miFare/iso7816/iso15693 và từ chối feliCa. Đây là đọc UID, chưa chứng minh xác thực mật mã thẻ hoặc chống clone. Backend claim chống replay qua hash/expiry/consume transactional. Lookup thẻ UID không có challenge-response, nên không được xem như chứng minh danh tính mạnh cho giao dịch nhạy cảm.

Tái sử dụng contract DTO, validation logic và kịch bản nghiệp vụ từ Swift. Expo cần adapter/native module/config plugin sau quyết định dependency. Camera Expo đã có permission plugin và dừng khi blur/background. Native NFC chưa có trong Expo app, development build và physical devices là exit gate. Android Emulator/iOS Simulator không chứng minh NFC hardware. Chưa đánh dấu DEVICE_E2E_PASSED.

V138 có unique passenger và (cruise_id,card_identifier), FK tới BookingPassenger/Cruise/User, claim hash unique. Chưa có endpoint revoke NFC trong controller đã đọc, cần nghiệp vụ mất thẻ/đổi thẻ. PassengerIdentifier/BLE phải được phân biệt với NFC card.

## M03 — POS Scanner/NFC (P1)

| Trường | Nội dung |
|---|---|
| Repository / file / dòng | FE `CASMS_MobileApp/src/features/pos/PosScanner.tsx:87` |
| Class/function | `onBarcodeScanned` |
| Kỳ vọng | Quét phải preview và xác minh theo phiên POS. |
| Thực tế | Mọi QR có nội dung đều thành unverified, không gọi Backend. Expo chưa có NFC module. |
| Nguyên nhân | Chưa tích hợp card workflow native. |
| Bằng chứng | Source tại vị trí trên, baseline ở đầu báo cáo |
| Trách nhiệm | FE |
| Phân loại / phase | IMPLEMENT, Phase B/D |
| Khuyến nghị | Nối preview/confirm/lookup, xác nhận tên khách trước cấp thẻ, chọn giải pháp native sau phê duyệt dependency. |
| Acceptance criteria | Claim hết hạn, replay, sai cruise bị từ chối, iPhone và Android thật được nghiệm thu. |
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


## Kiểm kê implementation POS

| File | Trách nhiệm | Tích hợp / phần còn thiếu |
|---|---|---|
| `PosLayout.tsx`, `pos-api.ts:34` | Employee context, credential thiết bị, mở/đóng terminal và revalidate | HTTP thật. Thiết bị role POS dùng token riêng hoặc credential terminal. Context ràng buộc ship, cruise, area và session. |
| `PosDashboard.tsx`, `pos-access.ts` | Hiển thị context và quyền, điều hướng theo quyền server | Dữ liệu context thật khi có session hợp lệ. Giữ UI fallback khi nhãn tàu/chuyến không đọc được. |
| `PosServices.tsx`, `pos-lifecycle.ts` | Catalogue, request, nhận/từ chối/hoàn tất, quantity/unit và trạng thái | Gọi API POS scoped. Usage do BE ghi khi xử lý nghiệp vụ, không phải quét QR tự sinh giao dịch. |
| `PosActivities.tsx` | Hoạt động, đăng ký và điểm danh | Gọi API vòng đời và attendance. Có PUT cập nhật registration ở BE, Mobile chưa gọi. |
| `PosUsage.tsx` | Bán dịch vụ, truy vấn giao dịch, hạn mức và sao kê | Gọi API sale/statement. Journal giữ key cho thao tác chưa rõ kết quả. Tra hồ sơ dùng lựa chọn phù hợp từ nguồn hiện có. |
| `PosScanner.tsx:87` | Xin quyền, CameraView, quét và reset | Camera đã nối native. Item QR hiển thị chưa xác minh. Claim preview, confirm và lookup chưa nối. |
| `pos-transport.ts:25`, `pos-contracts.ts` | Vận chuyển phiên scoped, Zod request/response | Đính X-POS-Session với endpoints /pos và kiểm context/sale/statement. |
| `pos-storage.ts` | SecureStore và bind owner/login epoch/backend, giữ pending sale | Có regression cleanup và cách ly, cần cold resume thiết bị thật. |

Expo SDK 58 đưa camera hiện tại vào Expo Go trên thiết bị tương thích. Expo Go phù hợp thử permission và quét QR. NFC cần mã native/entitlement, development build, iPhone/Android thật và kiểm tra loại thẻ. Repo không khai báo `expo-dev-client` hoặc cấu hình `eas.json` được track, nên Phase B/G cần lập profile internal development trước nghiệm thu. Swift có thể dùng làm tài liệu hành vi/DTO cho Expo, còn phần native cần thiết kế adapter và vòng đời đọc theo platform. [Camera SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/camera/), [Development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo Build](https://docs.expo.dev/build/introduction/).

## M17 — Contract gán dịch vụ vào khu vực (P2, BE)

`CASMS_Backend/src/test/java/com/casms/pos/PosPostgresIntegrationTest.java:770–782` mong 422 khi quản lý gán area service mà chưa có deck link. PostgreSQL QA nhận 200 ở dòng 776. `PosService.java:77–87` chủ động tạo deck link rồi ghi area assignment. Sale trên terminal trước bước quản lý đó vẫn bị từ chối đúng như test. Ca dừng trước nhánh kiểm model archived.

Phase D xác nhận hành vi nghiệp vụ với chủ domain POS/Ship, rồi đồng bộ Javadoc, regression test và API contract. Acceptance là hành vi quản lý được thống nhất, sale vẫn bị chặn khi thiếu scope và cả nhánh archived được chạy. Bằng chứng là Surefire PostgreSQL 40/41 ca pass, xem [báo cáo kiểm thử](CASMS_MOBILE_PHASE_0_TEST_REPORT.md).
