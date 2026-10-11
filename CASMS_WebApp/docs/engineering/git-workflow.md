# CASMS WebApp — Git Push, Pull Request & Merge Policy

**Phiên bản:** 1.0
**Ngày:** 11/10/2026
**Phạm vi:** `CASMS_WebApp/` trong repository `ShiroSs00/CASMS_Frontend`
**Canonical path đề xuất:** `CASMS_WebApp/docs/engineering/git-workflow.md`

---

## 1. Mục tiêu

Tài liệu này quy định cách tạo branch, commit, push, mở Pull Request, review và merge cho CASMS WebApp.

Mục tiêu:

- Không push nhầm code chưa kiểm tra.
- Không đưa thay đổi ngoài task vào commit/PR.
- Không làm hỏng `main`.
- Lịch sử Git dễ đọc, dễ audit và dễ rollback.
- Mỗi PR có thể truy ngược về task contract và bằng chứng validation.
- Codex/AI agent không được tự mở rộng quyền thay đổi hoặc tự push ngoài phạm vi người dùng cho phép.

Các từ khóa:

- **MUST**: bắt buộc.
- **MUST NOT**: tuyệt đối không được.
- **SHOULD**: nên thực hiện; bỏ qua phải có lý do.
- **MAY**: tùy chọn khi phù hợp.

---

## 2. Nguyên tắc bất biến

1. `main` là branch ổn định và **MUST NOT** được dùng để phát triển trực tiếp.
2. Mọi thay đổi code **MUST** đi qua task branch và Pull Request.
3. Mỗi branch **MUST** gắn với một task hoặc mục tiêu rõ ràng.
4. Mỗi PR **MUST** chỉ chứa thay đổi thuộc scope của task contract.
5. Không commit/push secret, `.env` thật, `node_modules/`, `dist/`, log tạm hoặc file IDE cá nhân.
6. Không được coi `build pass` là bằng chứng toàn bộ nghiệp vụ đúng.
7. Không được overwrite/revert các thay đổi có sẵn trước task nếu task không cho phép.
8. Không dùng `git push --force` trên `main` hoặc branch dùng chung.
9. Khi cần rewrite history trên branch cá nhân, chỉ dùng `--force-with-lease`, không dùng `--force`.
10. Một task chưa qua required checks **MUST NOT** được merge.

---

## 3. Branch protection

### 3.1 `main`

`main` phải được coi là protected branch.

**MUST NOT:**

```bash
git push origin main
git push --force origin main
git push --force-with-lease origin main
```

Thay đổi vào `main` phải thông qua Pull Request.

### 3.2 Cấu hình GitHub khuyến nghị

Khi repository bật branch protection/ruleset, `main` SHOULD có:

- Require a pull request before merging.
- Require at least **1 approval**.
- Dismiss stale approvals when new commits are pushed nếu team đủ người review.
- Require conversation resolution before merge.
- Require required status checks khi CI đã được cấu hình.
- Block force pushes.
- Block branch deletion.
- Require branch to be up to date trước merge nếu CI phụ thuộc trạng thái mới nhất.
- Không cho bypass branch protection trừ maintainer trong trường hợp khẩn cấp có ghi nhận.

Thay đổi high-risk như authentication, payment, authorization, global architecture hoặc cross-module behavior SHOULD có **2 approvals** nếu nguồn lực team cho phép.

---

## 4. Quy tắc đặt tên branch

Format:

```text
<type>/<TASK-ID>-<short-kebab-description>
```

Các `type` được phép:

| Type | Dùng cho |
| --- | --- |
| `feat` | Tính năng mới |
| `fix` | Sửa bug |
| `refactor` | Refactor không đổi hành vi |
| `docs` | Chỉ thay tài liệu |
| `test` | Test/harness |
| `chore` | Tooling/config/maintenance |
| `hotfix` | Lỗi production cần xử lý gấp |

Ví dụ:

```text
feat/WEB-014-issue-severity-filter
fix/WEB-021-resolution-state
docs/WEB-002-business-rules
chore/WEB-001-bootstrap
```

**MUST NOT** dùng tên mơ hồ:

```text
update
fix-bug
test123
huy-branch
new-code
final
final-v2
```

Một branch chỉ phục vụ **một task chính**.

---

## 5. Tạo branch đúng chuẩn

Trước khi tạo branch mới:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c <branch-name>
```

`git pull --ff-only` được dùng để tránh vô tình tạo merge commit trên local `main`.

Nếu working tree đang dirty, phải kiểm tra trước:

```bash
git status --short
```

Không checkout/reset làm mất thay đổi có sẵn.

---

## 6. Baseline trước khi code

Mỗi task phải ghi:

```text
Base commit: <SHA>
Baseline git status: <output hoặc none>
```

Trước lần sửa đầu tiên:

```bash
git rev-parse HEAD
git status --short
```

Các file đã modified/untracked/deleted/renamed trước task là **pre-existing worktree**.

Codex/developer **MUST NOT**:

- reset chúng;
- checkout đè chúng;
- commit ké chúng;
- nhận chúng là thay đổi do task tạo ra.

---

## 7. Quy tắc staging

Không dùng `git add -A` hoặc `git add .` một cách máy móc khi working tree có nhiều thay đổi.

Ưu tiên stage theo allowed paths:

```bash
git add CASMS_WebApp/src/features/...
git add CASMS_WebApp/docs/tasks/WEB-014.md
```

Trước commit phải kiểm tra:

```bash
git diff --cached --name-status
git diff --cached
```

Nếu staged diff chứa file ngoài task contract: **STOP** và loại file đó khỏi staged changes.

Ví dụ:

```bash
git restore --staged <path>
```

---

## 8. Quy tắc commit

### 8.1 Conventional Commits

Format chuẩn:

```text
<type>(<scope>): <imperative summary>
```

Các type chính:

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`
- `build`
- `ci`
- `perf`
- `style`

Ví dụ:

```text
feat(issue-management): add severity and status filters
fix(issue-detail): prevent invalid close transition
refactor(issue-management): extract timeline item component
docs(engineering): add git push policy
chore(web): configure eslint import boundaries
```

### 8.2 Task ID

Task ID SHOULD được ghi trong commit body hoặc footer:

```text
Task: WEB-014
```

Commit hoàn chỉnh:

```text
feat(issue-management): add severity and status filters

Task: WEB-014
```

### 8.3 Atomic commit

Mỗi commit SHOULD đại diện cho **một thay đổi logic có thể hiểu độc lập**.

Không gom chung:

- feature + refactor không liên quan;
- UI + sửa tài liệu ngoài scope;
- dependency upgrade không cần thiết;
- file format hàng loạt không liên quan.

### 8.4 Commit message cấm dùng

```text
update
fix
done
final
wip
changes
abc
test
```

`WIP` MAY dùng trên local branch tạm thời nhưng SHOULD được squash/reword trước khi PR sẵn sàng review.

---

## 9. Dependency và lockfile

Nếu task thêm/xóa/thay dependency:

- `package.json` và `package-lock.json` phải thay đổi nhất quán.
- Phải nêu dependency mới trong PR.
- Phải giải thích lý do cần dependency.
- Không được update hàng loạt dependency ngoài scope.

Nếu task **không** thay dependency nhưng `package-lock.json` đổi ngoài dự kiến: phải điều tra trước khi commit.

Không sửa lockfile Mobile trong task Web.

---

## 10. Pre-push gate

Trước mọi push để mở/update PR, developer/agent phải thực hiện review local.

### 10.1 Từ repository root

```bash
git status --short
git diff --check
git diff --name-status origin/main...HEAD
```

Kiểm tra:

- không có whitespace error;
- không có file ngoài scope;
- không có file nhạy cảm;
- không có file generated ngoài policy.

### 10.2 Từ `CASMS_WebApp/`

Required checks mặc định:

```bash
npm run lint
npm run typecheck
npm run build
```

Khi project đã có test harness:

```bash
npm test
```

hoặc command cụ thể được định nghĩa trong `docs/engineering/testing.md`.

Task UI phải kiểm tra thêm các viewport/state được contract yêu cầu.

Task bug logic SHOULD có regression test khi harness hỗ trợ.

### 10.3 Khi check không chạy được

Không được ghi `PASS`.

Phải ghi:

```text
NOT RUN — <lý do cụ thể>
```

Nếu check bắt buộc fail, branch MAY được push để collaboration/debug nhưng PR **MUST NOT** được đánh dấu ready-to-merge.

---

## 11. Secret & security gate

Trước push phải xác nhận không có:

- password;
- access token;
- private key;
- cookie/session;
- connection string;
- `.env` thật;
- production credential;
- user/customer private data.

Biến `VITE_*` không được dùng để lưu secret vì dữ liệu này được đưa vào client bundle.

Nếu phát hiện secret đã commit:

1. **Không chỉ xóa file rồi push tiếp.**
2. Dừng quy trình.
3. Thu hồi/rotate credential.
4. Xử lý lịch sử Git theo quy trình bảo mật.
5. Chỉ tiếp tục sau khi credential cũ không còn giá trị.

---

## 12. Quy tắc push

Push lần đầu:

```bash
git push -u origin <branch-name>
```

Push các lần sau:

```bash
git push
```

**MUST NOT** push trực tiếp `main`.

### 12.1 Force push

Mặc định: **cấm**.

Chỉ được phép khi tất cả điều kiện sau đúng:

- branch thuộc cá nhân/người thực hiện;
- không phải `main`;
- branch không được nhiều người cùng sửa hoặc đã phối hợp rõ;
- rewrite history là có chủ đích;
- người dùng/maintainer đã cho phép khi agent thực hiện.

Khi được phép:

```bash
git push --force-with-lease
```

Không dùng:

```bash
git push --force
```

---

## 13. Quy tắc riêng cho Codex / AI agent

Codex/AI **không có quyền mặc định để push** chỉ vì đã hoàn thành code.

Agent chỉ được push khi yêu cầu hiện tại của người dùng cho phép rõ ràng.

Agent **MUST**:

1. Đọc `AGENTS.md`, task contract và `git-workflow.md`.
2. Ghi base commit + baseline worktree trước khi sửa.
3. Chỉ stage file trong allowed paths.
4. Chạy required checks.
5. Review staged diff trước commit.
6. Không commit/push pre-existing worktree.
7. Không tự đổi branch strategy.
8. Không tự bypass failed checks.
9. Không tự merge PR.
10. Báo branch, commit SHA, checks và file thay đổi sau push.

Agent **MUST NOT**:

- push `main`;
- dùng `--force`;
- dùng `--force-with-lease` nếu người dùng chưa cho phép;
- amend/rebase commit của người khác trên shared branch;
- mở rộng scope chỉ để làm build pass;
- commit secret hoặc artifact generated không được phép;
- merge khi còn blocker.

---

## 14. Đồng bộ với `main`

Trước khi đưa PR vào final review:

```bash
git fetch origin
```

Nếu branch chỉ có một người làm và chưa gây ảnh hưởng cộng tác, MAY rebase:

```bash
git rebase origin/main
```

Nếu branch là shared branch, ưu tiên tránh rewrite history; phối hợp team trước khi rebase.

Sau rebase, nếu cần cập nhật remote và đã được phép:

```bash
git push --force-with-lease
```

Mọi conflict phải được resolve có chủ đích; không chọn `ours/theirs` hàng loạt mà không hiểu thay đổi.

Sau resolve phải chạy lại validation liên quan.

---

## 15. Pull Request policy

Mọi thay đổi vào `main` phải qua PR.

### 15.1 PR title

Format:

```text
[TASK-ID] <type>(<scope>): <summary>
```

Ví dụ:

```text
[WEB-014] feat(issue-management): add issue list filtering
```

### 15.2 PR description bắt buộc

```markdown
## Outcome
<Mục tiêu task>

## Task
WEB-014

## Scope
- <file/module chính>

## Changes
- <thay đổi 1>
- <thay đổi 2>

## Validation
- npm run lint — PASS
- npm run typecheck — PASS
- npm run build — PASS
- <test khác>

## UI verification
- <viewport/state đã kiểm tra, nếu có>

## Risk
- <rủi ro hoặc none>

## Out of scope
- <những gì cố ý không sửa>

## Evidence / references
- <task contract>
- <Figma/BR/API ID nếu áp dụng>
```

PR không được chỉ ghi `"done"`, `"fix"` hoặc để trống khi thay đổi đáng kể.

---

## 16. Code review gate

Reviewer kiểm tra ít nhất:

1. Task outcome có được đáp ứng không.
2. Diff có nằm trong allowed paths không.
3. Có regression hoặc side effect không.
4. Error/empty/loading/state transition đã hợp lý chưa.
5. Security/auth/validation có bị suy yếu không.
6. Public API/props/model có thay đổi ngoài contract không.
7. Test có chứng minh hành vi quan trọng không.
8. UI có accessibility/responsive theo scope không.
9. Dependency/lockfile có hợp lý không.
10. Tài liệu authoritative có cần cập nhật không.

Finding phải có:

- severity;
- file/location;
- impact;
- trigger;
- fix direction.

Blocker chưa xử lý thì **MUST NOT merge**.

---

## 17. Merge policy

Mặc định CASMS dùng **Squash Merge** cho feature/fix/task branch.

Lợi ích:

- `main` giữ lịch sử gọn;
- một PR tương ứng một logical change;
- dễ revert toàn bộ PR.

Commit squash nên dùng PR title chuẩn:

```text
[WEB-014] feat(issue-management): add issue list filtering
```

**MUST NOT** merge khi:

- required check fail;
- conflict chưa resolve;
- review blocker còn mở;
- diff có file ngoài scope;
- PR chứa secret;
- task contract chưa đạt acceptance criteria bắt buộc.

Sau merge:

- delete remote task branch;
- local branch có thể xóa sau khi xác nhận merge thành công.

---

## 18. Rollback policy

Không rewrite lịch sử `main` để rollback.

Nếu một PR đã merge gây lỗi:

```bash
git revert <merge-or-squash-commit>
```

Tạo PR rollback/hotfix mới.

Rollback phải giữ trace tới PR/task gây regression.

---

## 19. Hotfix

Hotfix vẫn không được push trực tiếp `main`.

Flow:

```text
main
  └── hotfix/WEB-XXX-short-description
        └── PR
              └── main
```

Hotfix có thể dùng review rút gọn nhưng vẫn phải có:

- scope rõ;
- validation tối thiểu;
- không có secret;
- reviewer độc lập nếu khả thi;
- completion evidence.

Check bị bỏ qua vì khẩn cấp phải được ghi rõ trong PR và follow-up task phải được tạo nếu còn technical debt.

---

## 20. Các hành vi bị cấm

Các hành vi sau là **BLOCKER**:

- Direct push vào `main`.
- Force push `main`.
- Commit secret.
- Commit file ngoài task scope mà không được mở rộng contract.
- Xóa/revert code người khác để làm task dễ hơn.
- `git reset --hard` trên worktree có thay đổi chưa được xác nhận.
- `git clean -fd` khi chưa xác nhận file untracked.
- Dùng `git add .` rồi commit mà không review staged diff.
- Merge với check bắt buộc đang fail.
- Merge khi còn conflict.
- Tự thay business rule/API contract để làm UI chạy.
- Commit `node_modules/`, `dist/`, `.env`.
- Đổi dependency/lockfile không liên quan task.
- Gộp nhiều task độc lập vào một PR lớn.

---

## 21. Pre-push checklist

Trước `git push`, phải xác nhận:

- [ ] Đang ở đúng task branch, không phải `main`.
- [ ] Base commit/baseline đã được ghi.
- [ ] Không overwrite pre-existing worktree.
- [ ] Diff chỉ nằm trong allowed paths.
- [ ] Không có secret/.env/node_modules/dist.
- [ ] `git diff --check` pass.
- [ ] Staged diff đã review.
- [ ] Commit message đúng convention.
- [ ] `npm run lint` pass.
- [ ] `npm run typecheck` pass.
- [ ] `npm run build` pass.
- [ ] Test liên quan pass hoặc ghi rõ NOT RUN.
- [ ] Lockfile chỉ đổi khi dependency thực sự đổi.
- [ ] Không có debug log/fixture tạm.
- [ ] Boundary-test fixture tạm đã được xóa.
- [ ] Có thể giải thích rõ từng file được push để làm gì.

---

## 22. Pre-merge checklist

Trước merge PR:

- [ ] PR title đúng format.
- [ ] PR description có outcome/scope/validation/risk.
- [ ] Required review đã approve.
- [ ] Review blocker đã resolve.
- [ ] Required checks pass.
- [ ] Branch đã đồng bộ phù hợp với `main`.
- [ ] Không có conflict.
- [ ] Không có file ngoài scope.
- [ ] Acceptance criteria đạt.
- [ ] Authoritative docs được cập nhật nếu hành vi/kiến trúc thay đổi.
- [ ] Không có secret hoặc credential.
- [ ] Squash commit message có thể hiểu độc lập.
- [ ] Merge xong có thể rollback bằng một revert rõ ràng.

---

## 23. Standard command flow

Ví dụ với `WEB-014`:

```bash
# 1. Đồng bộ
git fetch origin
git switch main
git pull --ff-only origin main

# 2. Tạo branch
git switch -c feat/WEB-014-issue-severity-filter

# 3. Ghi baseline
git rev-parse HEAD
git status --short

# 4. Code theo task contract

# 5. Validate
cd CASMS_WebApp
npm run lint
npm run typecheck
npm run build
cd ..

# 6. Review diff
git status --short
git diff --check
git diff --name-status origin/main...HEAD

# 7. Stage theo scope
git add CASMS_WebApp/<allowed-paths>

# 8. Review staged changes
git diff --cached --name-status
git diff --cached

# 9. Commit
git commit -m "feat(issue-management): add severity filter" -m "Task: WEB-014"

# 10. Push task branch
git push -u origin feat/WEB-014-issue-severity-filter

# 11. Mở PR, review, CI, squash merge
```

---

## 24. Tích hợp với `AGENTS.md`

Thêm vào `CASMS_WebApp/AGENTS.md`:

```markdown
## Git / Push
- Đọc `docs/engineering/git-workflow.md` trước khi commit, push hoặc chuẩn bị PR.
- Không push trực tiếp `main`.
- Agent chỉ được push khi người dùng cho phép rõ ràng.
- Chỉ stage/commit file thuộc allowed paths của task contract.
- Trước push phải review staged diff và chạy required checks.
- Không dùng `git push --force`; `--force-with-lease` chỉ khi policy cho phép và người dùng đã chấp thuận.
- Không merge PR nếu còn blocker hoặc required check fail.
```

---

## 25. Enforcement roadmap

Tài liệu là policy; để chuyển thành enforcement kỹ thuật, nên triển khai theo thứ tự:

1. GitHub branch protection/ruleset cho `main`.
2. Pull Request template.
3. GitHub Actions chạy `npm ci`, lint, typecheck, build và test.
4. CODEOWNERS cho module/high-risk area khi team đủ ổn định.
5. Commitlint nếu team muốn enforce Conventional Commits tự động.
6. Allowed-path checker cho task contract nếu workflow Codex sử dụng thường xuyên.
7. Secret scanning/dependency scanning khi repository sẵn sàng.

Không đánh dấu một rule là “được enforce” nếu hiện tại mới chỉ được viết trong tài liệu.

---

## 26. Definition of Done cho push/PR

Một thay đổi chỉ được coi là hoàn tất khi:

1. Code nằm đúng task branch.
2. Diff đúng scope.
3. Required checks pass hoặc limitation được ghi chính xác.
4. Commit/PR có trace tới task.
5. Review blocker đã xử lý.
6. Không có secret hoặc file generated không hợp lệ.
7. PR được merge theo policy.
8. `main` vẫn build được sau merge.
9. Completion evidence ghi rõ commit/PR/checks.
10. Branch task được dọn sau merge khi không còn cần thiết.
