# Phase 3 — Rà soát UI/UX WebAdmin

## Phạm vi và skill

- `.agents/skills/ui-ux-pro-max/SKILL.md` áp dụng cho table, multi-step form, feedback và keyboard. Tìm guideline về validation cạnh field, focus và data table. Các palette đề xuất từ bộ tìm kiếm nhường cho token OceVie đã chốt.
- `C:/Users/quanh/.codex/skills/impeccable/SKILL.md` áp dụng Operate và Craft floor cho mật độ tác vụ, thứ bậc và phát hiện lỗi bố cục. Detector cơ học trên trang danh sách, chi tiết và nhóm form trả `[]`.
- `C:/Users/quanh/.codex/skills/frontend-testing-debugging/SKILL.md` áp dụng cho render, interaction và breakpoint. Kiểm thử bằng trình duyệt in-app kết nối API thật qua Vite.
- `computer-use` dùng để kiểm thử browser và ghi nhận ảnh. `animate-ui` có cài trong workspace. Luồng sử dụng tương tác và loading có sẵn.

## Kết quả quan sát

| Kiểm tra | Bằng chứng |
| --- | --- |
| Desktop | Màn Admin có một thao tác chính, đọc được thông số loại và phiên bản. Màn Ship Manager tách thông tin kế thừa, dữ liệu riêng và xác nhận. Viewer dùng renderer Three.js hiện có và xử lý nguồn 2D trống. |
| Tablet, viewport 768 × 1024 | `documentElement.clientWidth = scrollWidth = 753` sau khi trừ scrollbar. Bảng 720 px cuộn bên trong vùng 653 px. Form lọc xuống hàng, nhãn và focus tìm kiếm vẫn hiển thị. |
| Bàn phím | Enter áp dụng tìm kiếm Aurora 02. Form tạo tàu đánh dấu `aria-invalid` khi thiếu tên và focus sang bước hoặc trường cần sửa. Link tab dùng `aria-current` theo route. |
| Loading, empty và lỗi | Loại mới ban đầu có danh sách tàu trống. Tàu thiếu ảnh hiện trạng thái tương ứng. Thử READY khi thiếu hồ sơ cho thấy cả ba nhóm Backend yêu cầu. Ship Manager vào màn tạo loại nhận màn 403. |
| Canvas | Aurora 01 chọn boong và cabin QA-01, viewer hiển thị mesh, cabin được tô chọn và báo đã liên kết cấu trúc của đúng tàu. |

Ảnh đã chụp trong phiên kiểm thử gồm chi tiết loại, viewer và bảng tablet. Chưa thử riêng trình đọc màn hình, ảnh 2D thật hoặc các engine trình duyệt khác. Dữ liệu hình học giản lược và tài khoản trong ảnh chỉ thuộc môi trường QA cô lập.
