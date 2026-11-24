# OceVie Cruises Mobile

CASMS Mobile đồng hành cùng hành khách sau khi khách hoàn tất đặt chỗ và kích hoạt tài khoản trên Web Booking. App đọc chuyến đã đặt, cabin, lịch trình, thông báo và hỗ trợ yêu cầu dịch vụ trên tàu. Nhân viên dùng luồng Staff POS riêng. Đăng ký, kích hoạt, bán vé và thanh toán tiền vé diễn ra trên Web.

## Chạy trên Windows

Dùng Node.js 22.18 trở lên và npm. Sau khi cài dependencies đã khóa bằng `npm ci`, sao chép `.env.example` thành `.env.local` và đặt `EXPO_PUBLIC_API_URL` theo môi trường.

| Nơi chạy app | URL khi Backend chạy cổng 8080 |
|---|---|
| Expo Web trên máy Windows | `http://127.0.0.1:8080/api` |
| Android Emulator trên máy chạy Backend | `http://10.0.2.2:8080/api` |
| iOS Simulator trên máy Mac chạy Backend | `http://127.0.0.1:8080/api` |
| Android/iPhone thật, hoặc simulator khác máy Backend | Dùng IP LAN của máy chạy Backend và cổng tương ứng |
| QA build và production | Dùng URL HTTPS được cấp riêng cho từng môi trường |

Chạy `start-mobile.bat` cho Expo dev server, `start-mobile.bat --android` cho Android hoặc `start-mobile.bat --web` cho web preview. Máy thật cần truy cập được API qua LAN hoặc URL triển khai. iOS Simulator chạy trên macOS. Endpoint có thể khai báo dưới dạng origin hoặc kết thúc bằng `/api`. App chuẩn hóa suffix API và yêu cầu URL HTTP/HTTPS rõ ràng. Đổi môi trường cần build/reload bằng URL mới và đăng nhập vào môi trường đó. Các biến `EXPO_PUBLIC_*` được nhúng vào bundle nên chỉ dùng cho dữ liệu công khai.

## Kiểm thử

- `run-mobile-tests.bat` chạy typecheck, lint và unit test. Có thể chạy riêng bằng `npm run typecheck`, `npm run lint`, `npm test`.
- `run-mobile-tests.bat --qa` hoặc `npm run test:qa` chạy suite HTTP khi đội Backend đã cấp và xác nhận môi trường. Xem [QA qua API thật](docs/real-api-qa.md).
- `npx expo export --platform all` kiểm bundling và static render. Đặt `EXPO_PUBLIC_API_URL` của môi trường build trước khi xuất.

[Passenger API](docs/passenger-live-api.md) · [Staff POS](docs/onboard-staff-pos.md) · [OceVie Mobile](docs/ocevie-mobile-ux.md).
