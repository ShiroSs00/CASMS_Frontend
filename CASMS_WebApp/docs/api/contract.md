# API contract

Status: UNCONFIRMED

Source: chưa được backend xác nhận tính đến 2026-10-11.

WEB-001 không gọi API và không định nghĩa base URL, endpoint, schema, auth, error code hay mock fallback. File `.env.example` vì vậy chỉ ghi chú an toàn và không khai báo biến runtime.

Khi tích hợp backend, mỗi endpoint cần source/revision, owner xác nhận nếu có, method/path, request/response schema, auth, error contract và trạng thái xác nhận. Giá, tồn cabin, quyền và thanh toán do backend quyết định cuối cùng.
