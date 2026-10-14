# WEB-OIM-REG-003 — Kết nối API OIM / Regulation

Trạng thái: IMPLEMENTED AT FE CONTRACT LEVEL — E2E PENDING.

Phụ trách: Phan Văn Huy. Đối chiếu mới nhất: 2026-10-14.

## Phạm vi và baseline

- FE base: `964cc419a9ab46d2837489873b97a879c0e2ffad`.
- Nhánh: `feat/WEB-OIM-REG-003-live-api-integration`; không sửa main.
- Giữ nguyên các thay đổi FE chưa commit của integration và WEB-PAGINATION-001.
- Giữ các mục ngoài phạm vi: `.agents/`, `skills-lock.json`, thay đổi `.gitignore` có sẵn.
- BE chỉ đọc: revision `31ed42db0822f2f6d0e5572350daa61cfdbe420e`.
- BE baseline/final: hai file sửa sẵn `.idea/misc.xml`, `src/main/resources/application-dev.yml`.
- Hash `git diff | git hash-object --stdin` BE trước/sau:
  `b742feac4aba756de4e8b27c6869bf6f2e4e5919`.

## Contract hiện tại

- OIM và Regulation dùng API thật qua /api. Không tự fallback sang mock khi read/write lỗi.
- DTO/envelope map tại feature boundary; transport giữ HTTP status, code, details, traceId.
- OIM hỗ trợ sáu action bằng endpoint BE; resolver/verifier do JWT principal xác định.
- Người xử lý lấy từ identity/users. Lookup lỗi được ghi rõ, không biến reporter thành ứng viên.
- Regulation dùng conflict verdict/precheck theo host và effective snapshot của BE.
- Search/filter/phân trang ở FE; OIM tải tập dữ liệu một lần mỗi mount/retry rồi lọc/cắt trang.
- Giữ thiết kế hiện tại; skill design tokens được dùng để giữ palette/status tokens, không đổi theme.
- Phần thiếu API hoặc thiếu bảo đảm nghiệp vụ: xem
  [BE-OIM-REG-003-integration-gaps.md](BE-OIM-REG-003-integration-gaps.md).
- Kết quả/tài liệu demo và evidence ngày 2026-10-13 là lịch sử, không mô tả runtime hiện tại.

## Allowed paths (dưới CASMS_WebApp)

- src/features/operational-issues/**
- src/features/regulations/**
- src/shared/api/**
- src/shared/pagination.ts
- tests/**
- docs/tasks/WEB-OIM-REG-003.md
- docs/tasks/WEB-PAGINATION-001.md
- docs/tasks/BE-OIM-REG-003-integration-gaps.md
- docs/engineering/module-map.md

Không sửa file trong CASMS_Backend. Không thêm dependency.
Người dùng đã yêu cầu commit/push tiếp theo; chỉ publish task branch, không merge main.

## Evidence mới

Node 24.19.0; các lệnh sau exit 0:

- `node --test tests/*.test.mjs`: 31 pass, 0 fail.
- `npm run lint`, `npm run typecheck`, `npm run build`: pass (188 modules).
- `git diff --check`: pass.
- Test guard conflict đã red/green bằng cách tạm bỏ guard, xác nhận fail, khôi phục và pass.
- Vite tại http://127.0.0.1:5173; GET /admin/issues trả HTTP 200 (chỉ chứng minh phục vụ SPA).
- BE :8080 không kết nối; Docker engine chưa hoạt động. Không có live mutation/E2E evidence.
- Chưa xác minh render/interaction desktop/mobile; không tuyên bố Figma fidelity hoặc hoàn thành 100%.

## Tiêu chí nghiệm thu còn chờ

- BE chạy được với schema mới; có nguồn JWT chính thức để Record/Verify.
- Browser walkthrough list/detail/form/assignment trên dữ liệu thật, desktop và narrow viewport.
- Xác nhận persistence sau mỗi mutation và khả năng xử lý xung đột thay đổi sau precheck.
