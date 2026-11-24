# Cấu hình API Mobile

Baseline FE `3c01db0`, BE `0bc2b38` trên `main`. Remote GitHub xác nhận cùng HEAD.

**Đã đọc:** `.env.example`, `app.json`, `src/lib/api/{index,api-client}.ts`, `session-store.ts`, `tests/integration/`, tài liệu SDK 58. **Đã sửa:** hai env example, transport/index, root layout, session store và script start. Trước đây Expo dev suy hostname từ Metro còn web export thiếu URL có thể hỏng lúc render check-in. Sau thay đổi mọi môi trường có một URL tường minh và màn hướng dẫn dùng Scaffold/EmptyState khi chưa cấu hình.

| Client | URL ví dụ nếu backend cổng 8080 |
|---|---|
| Windows/Web hoặc iOS Simulator cùng máy | `http://127.0.0.1:8080/api` |
| Android Emulator cùng máy | `http://10.0.2.2:8080/api` |
| Android/iPhone thật | HTTP LAN của máy host Backend trong môi trường phát triển, hoặc HTTPS deployment đã cấp |
| QA preview/release | HTTPS QA được cấp riêng |
| Production | HTTPS production do đội vận hành cung cấp |

URL không có giao thức, credential, query và fragment bị từ chối. Xóa slash cuối, giữ prefix triển khai và chuẩn hóa đúng một hậu tố `/api`. App không dùng URL test hay Metro làm fallback. QA Node harness dùng biến riêng, credential trong tệp local được bỏ qua Git. Môi trường thay đổi thì phiên lưu cũ không được chuyển sang API mới. Màn lỗi cấu hình hiển thị trước login; script Windows báo biến cấu hình cần đặt.

Transport tiếp tục phân biệt raw/envelope, 204/205, envelope thành công không có data và 2xx malformed payload. Code BE vẫn có cho adapter, thông điệp UI dùng chuỗi tiếng Việt theo status. Abort giữ AbortError, lỗi mạng và timeout khác nhau. 401 có kiểm token/generation trước khi xóa phiên. 403 còn hạn giữ phiên. Authorization và POS header giữ contract cũ, request mutation không tự retry.

**Acceptance/evidence.** Unit cho URL/protocol/credentials, AbortError, HTTP, malformed và void; smoke start thiếu env trả exit 2. Xem [regression](CASMS_MOBILE_PHASE_A0_FE_REGRESSION.md). Dependency ngoài FE là URL do đội vận hành cấp và thiết bị truy cập được địa chỉ đã cấu hình. [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo Env](https://docs.expo.dev/guides/environment-variables/).
