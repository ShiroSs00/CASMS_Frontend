# Phase 3 — Triển khai WebAdmin

## Luồng và API thực tế

| Bề mặt | HTTP |
| --- | --- |
| Danh sách và chi tiết loại | GET `/ship-types` với `q`, `status`, `page`, `size`. GET `/ship-types/{typeId}`, GET `/ship-types/{typeId}/ships` có phân trang. |
| Thêm loại và thay phiên bản | POST multipart `/ship-model-assets`. GET `/ship-model-assets/{modelKey}/preview?assetVersion=…` và GLB dưới `/versions/{assetVersion}/assets/…`. POST `/ship-types/from-stored` hoặc PUT `/ship-types/{typeId}/model`, body gồm modelKey và assetVersion. PATCH trạng thái qua `/ship-types/{typeId}/status`. |
| Tạo tàu và khôi phục | GET danh mục ACTIVE. POST `/ship-types/{typeId}/ships` với `{shipName, profile}` cùng UUID `Idempotency-Key`. Khi mạng gián đoạn, GET `/ship-types/{typeId}/ships/provisioning/{requestKey}`. Sau khi 404 cho phép thử lại với đúng key và body. |
| Tàu, hồ sơ và trạng thái | GET `/ships` và GET `/ships/{shipId}`. PATCH cơ bản vẫn giữ contract. Manager dùng PATCH `/ships/{shipId}/name`. GET/PUT `/ships/{shipId}/operational-profile`. POST `/ships/{shipId}/status` và hiển thị `details.missingGroups`. |
| Hồ sơ 2D/3D và lịch | GET `/ships/{shipId}/model`, model manifest và deck/cabin mappings theo cùng cặp ID tàu và model. Tái sử dụng API `current-cruise`, `availability` và `affected-cruises` cho lịch khai thác. |

- `/admin/ship-types`, `/new`, `/:typeId` và `/:typeId/edit` phân quyền theo Admin. Ship Manager có thể đọc chi tiết loại ACTIVE và tạo tàu. Route `/admin/ship-import` của Admin điều hướng sang `/admin/ship-types/new`. Các route mô hình kỹ thuật và chi tiết tàu được giữ.
- Tạo loại chỉ gửi hai trường cần thiết. Retry sau kết quả chưa rõ kiểm tra mã và chính xác phiên bản trước. Thao tác tạo tàu giữ key và body theo phiên làm việc của tài khoản.
- Danh sách lấy từng trang ở Backend khi không lọc, hoặc khi chỉ lọc theo loại có quyền truy vấn. GET `/ships` chưa nhận tìm tên/mã và trạng thái kết hợp. Các kiểu lọc đó đọc các trang trong phạm vi được phép rồi lọc ở FE.
- Số khách, số boong và kích thước kế thừa từ loại. Ngày bàn giao và các định danh thực tế ở `ShipOperationalProfile`. Mã tàu do Backend cấp.
- API asset chỉ gửi token đến API origin đã cấu hình. Đường dẫn GLB thiết kế lấy từ manifest và qua kiểm tra segment. Tài khoản Ship Manager đọc viewer gắn với tàu trong phạm vi quản lý.

## File và component

- `src/app/router.tsx` và `ship-workflow-routes.ts` nối trang quản lý tàu với viewer ở cấp ứng dụng để giữ ranh giới module.
- `src/features/ship-deck-cabin/ship-types/` thêm Catalog, DesignForm, DesignPreview, ProvisionPage, ProfileFields, ShipProfilePanel, adapter API, validation, lưu trạng thái retry, viewer context và CSS module.
- `ShipListPage.tsx`, `ShipManagementPage.tsx`, `ShipSchedule.tsx`, `OperationDialog.tsx`, DTO và adapter danh sách thực hiện nghiệp vụ tàu, hồ sơ và vận hành.
- `ModelViewerPage.tsx`, `ModelCanvas.tsx`, các public exports và import route giữ renderer và chức năng kỹ thuật. API import không còn hàm POST register vật lý.
- `work-policy.ts`, `api-permissions.json`, `admin-navigation.ts` và `shared/api/client.ts` đồng bộ role và quyền tài nguyên. `tests/ship-workflow.test.mjs` kiểm tra contract và đường dẫn.

Chi tiết QA xem [báo cáo tích hợp](CASMS_SHIP_PHASE_0_TO_3_INTEGRATION_REPORT.md).
