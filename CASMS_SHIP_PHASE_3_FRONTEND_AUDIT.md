# Phase 3 — Audit WebAdmin quản lý tàu

Frontend dùng `e9db70a362500ffd80251e3c58c68c87efa79f67` theo yêu cầu, trong worktree riêng. Checkout người dùng ở `2d902ef38f1bd7ded90852321f29f30ce4c27736` có chỉnh sửa Cruise và tài liệu chưa commit. Backend dùng `a37c4d5ae763c100f58a9e09abfe9abb4b234e98` cùng patch Phase 0–2. Contract được đối chiếu từ `docs/ship-redesign/CASMS_SHIP_BE_HANDOFF_FOR_FE.md`, controller và test chạy với PostgreSQL.

| Điểm baseline | Quyết định triển khai |
| --- | --- |
| Route `/admin/ship-import` dùng ShipImportPage, ImportDialog và register manifest để tạo tàu, trong khi Backend trả 410. | Redirect có guard về form loại tàu. Tái sử dụng bộ đọc ZIP, fingerprint, khung ModelCanvas và các thành phần import cho cập nhật mô hình trên tàu hiện hữu. Xóa hàm gọi route register đã nghỉ. |
| ShipFormPage có nhánh tạo tàu thủ công và lưu qua `POST /ships`. | `/admin/ships/new` dùng màn chọn loại và hồ sơ riêng, gửi `POST /ship-types/{id}/ships`. FormPage tiếp tục xử lý PATCH và các form boong/cabin. |
| ShipListPage tải bản ghi và thông tin bổ sung để hiển thị card. FleetDashboardPage cũng có card cho công việc tổng quan. | Màn danh sách dùng DataTable và phân trang server khi có truy vấn phù hợp. Tổng quan giữ phần số liệu và card hiện hành. Dùng shipTypeId để phân loại, và nhãn loại từ ShipResponse. |
| ShipManagementPage có thông tin, boong, cabin, khu vực dịch vụ. ShipOverview đọc cấu hình và chuyến đang thực hiện. | Giữ nội dung và deep link. Bổ sung phần loại, hồ sơ, mô hình và lịch khai thác. Tái sử dụng modal đổi trạng thái và kiểm tra lịch. |
| ModelViewerPage có luồng chọn tàu, ModelCanvas, các trình đọc manifest và giao diện boong/cabin. | Viewer hồ sơ dùng cùng trình dựng. Chọn asset theo model đang dùng của tàu và đọc ánh xạ riêng. Giữ trang kỹ thuật và các URL đọc cũ. |
| Route và HTTP permission policy kiểm tra role/work scope cùng effectivePermissions từ `/auth/me`. | Cập nhật AdminGuard, PermissionLink, navigation và api-permissions theo controller Backend. Quyền từ vai trò dùng đúng cho các endpoint role-only. Không thêm authority ghi model cho manager. |

Đã đọc AGENTS.md ở root và WebAdmin, tài liệu thiết kế và token OceVie, README và SKILL.md của UI/UX Pro Max. Dùng các shared Button, Field, Modal, Notice, Panel, DataTable, ListFooter và AdminShell. Bố cục bảng/table, form theo bước và điều hướng tài liệu thuộc cùng nghiệp vụ quản lý tàu và dùng token hiện có.
