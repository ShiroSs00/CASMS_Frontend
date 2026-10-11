# <ID> — <Tên task>

Status: PROPOSED | ACTIVE | DONE | BLOCKED
Base commit: `<SHA thật>`
App root: `CASMS_WebApp`

## Baseline worktree

Captured before edits: `<yes/no>`

Pre-existing modified/untracked/deleted/renamed paths:

- `<tóm tắt từ git status --short, hoặc none>`

Các path có sẵn trước task phải được bảo toàn. Không reset, checkout, overwrite hoặc gộp chúng vào completion evidence trừ khi nằm rõ trong allowed changes.

## Outcome

`<Một kết quả quan sát được; trước/sau nếu là bug>`

## Authoritative inputs

- `<Đường dẫn, section/BR/screen/API ID cụ thể>`
- `<Nguồn còn thiếu; phần nào không được suy đoán>`

## Allowed changes

- `<Danh sách file hoặc glob hẹp, tính từ root repository>`
- `<Nêu rõ file mới có được tạo, file nào được xóa/đổi tên>`

## Read-only dependencies

- `<Có thể đọc nhưng không sửa>`

## Out of scope

- `<Tính năng, dependency, token, endpoint hoặc module không được đổi>`

## Acceptance criteria

- [ ] `<Hành vi đúng, có thể kiểm tra>`
- [ ] `<Edge case/trạng thái/UI liên quan>`
- [ ] Không có thay đổi ngoài allowed paths

## Validation

- `<Lệnh tồn tại trong package.json, chạy từ thư mục nào>`
- `<Test hoặc thao tác kiểm tra hành vi>`

## Scope expansion

Nếu cần sửa ngoài allowed paths: nêu file, lý do và impact. Chỉ sửa sau khi phạm vi đã được người dùng mở rộng hoặc đã được cho phép rõ trong yêu cầu.

## Completion evidence

- Baseline worktree đã đối chiếu lại: yes/no
- File thêm/sửa/xóa/đổi tên do task này tạo ra:
- Checks: command, pass/fail/not-run và lý do:
- Acceptance criteria chưa đáp ứng:
- Rủi ro hoặc nguồn chưa xác nhận:
