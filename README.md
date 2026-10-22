# CASMS_Frontend

## Chạy BE và FE để test trên Windows

Đặt `CASMS_Frontend` và `CASMS_Backend` cạnh nhau trong cùng thư mục cha, rồi nhấp đúp `start-dev.bat`.

- Cần Node.js 24, npm 11, JDK 21 và Maven trong `PATH`.
- PostgreSQL phải chạy sẵn theo cấu hình BE (mặc định `localhost:5432/casms`).
- Script mở hai cửa sổ log, tự chạy `npm ci` nếu chưa có Vite và mở FE tại <http://localhost:5173>.
- Chờ BE khởi động xong tại <http://localhost:8080/api> trước khi test tính năng gọi API.
- Dừng từng server bằng `Ctrl+C` trong cửa sổ tương ứng.

Kiểm tra đường dẫn và công cụ mà không khởi động server:

```bat
start-dev.bat --check
```
