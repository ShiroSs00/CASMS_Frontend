# WEB-PAGINATION-001 — Phân trang hoàn toàn tại Frontend

Trạng thái: IMPLEMENTED — tests pass; browser walkthrough pending.

Người phụ trách: Phan Văn Huy

## Mục tiêu

Frontend nhận danh sách đầy đủ từ Backend rồi tự search, filter và phân trang cho:

- danh sách Operational Issue;
- danh sách Regulation;
- danh sách Regulation trực tiếp/kế thừa;
- danh sách ứng viên trong hộp thoại Assign Regulation.

Backend không nhận `page`, `pageSize` hoặc `sort` từ các luồng trên.

Ngoại lệ danh mục tham chiếu: API /ship đã phân trang sẵn, FE đọc hết các trang lookup.
Đây không phải yêu cầu bổ sung pagination cho OIM hoặc Regulation.

## Hành vi bắt buộc

- Page và page size không hợp lệ được chuẩn hóa về lựa chọn an toàn.
- Page vượt quá tổng trang được kẹp về trang cuối và URL được sửa bằng `replace`.
- Thay đổi search/filter/page size đưa người dùng về trang 1.
- OIM và Regulation list lưu trạng thái phân trang trong URL để refresh/back/forward giữ đúng view.
- Hiển thị khoảng dòng, tổng kết quả, trang hiện tại, nút trước/sau và dải số trang rút gọn.
- Điều khiển có label, trạng thái disabled, `aria-current` và focus bằng bàn phím.
- Candidate/assignment pagination là state cục bộ; đổi context xóa selection/conflict cũ.

## Seam kiểm thử

- `src/shared/pagination.ts`: cắt dữ liệu, kẹp page, range rỗng và dải số trang.
- OIM query URL: page size chỉ nhận lựa chọn FE cho phép.
- Regulation query URL: parse/serialize filter, page và page size.

## Đường dẫn được phép sửa

- `src/shared/pagination.ts`
- `src/features/operational-issues/**`
- `src/features/regulations/**`
- `tests/pagination.test.mjs`
- `docs/tasks/WEB-PAGINATION-001.md`
- `docs/engineering/module-map.md`

Không sửa bất kỳ file nào trong `CASMS_Backend`.

## Kiểm tra hoàn thành

- `node --test tests/*.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Kiểm tra route OIM và Regulation qua trình duyệt ở desktop/narrow viewport.
- Xác nhận lại `git status` của Backend.

## Kết quả 2026-10-14

- OIM lọc/cắt trang từ tập dữ liệu đầy đủ tải khi mount/retry; đổi filter/page không gọi lại API.
- Regulation giữ URL filter/page/page size; đổi trang không refetch, đổi filter tải lại list rồi lọc/cắt tại FE.
- Assignment dùng effective snapshot BE (giới hạn ngoài hiệu lực ghi tại BE-OIM-REG-003).
- Candidate đổi filter/page hủy hiệu lực precheck cũ; đổi host remount state.
- Invalid effectiveAt trong URL trở về mặc định an toàn; mặc định live dùng hiện tại, không dùng ngày demo.
- 31 test root pass; lint/typecheck/build pass trên Node 24.19.0.
- Browser interaction chưa kiểm chứng; BE runtime chưa chạy. Không đánh dấu nghiệm thu E2E.
