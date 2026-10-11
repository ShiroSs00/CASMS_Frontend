# CASMS WebApp

Nền React + Vite + TypeScript của CASMS. WEB-001 chỉ cung cấp technical shell, routing và ranh giới module; chưa chứa tính năng nghiệp vụ CASMS.

## Bắt đầu

Yêu cầu Node.js `24.21.0` và npm `11.19.0` (xem [hướng dẫn development](docs/engineering/development.md)).

```bash
npm ci
npm run dev
```

Các kiểm tra bắt buộc:

```bash
npm run lint
npm run typecheck
npm run build
```

Không có script `test` trong WEB-001 vì chưa có test harness hoặc hành vi nghiệp vụ cần kiểm thử.

## Nguồn chuẩn

- [Mục lục và trạng thái tài liệu](docs/README.md)
- [Kiến trúc và import boundaries](docs/engineering/architecture.md)
- [Bản đồ module hiện có](docs/engineering/module-map.md)
- [Quy trình branch, commit, push và Pull Request](docs/engineering/git-workflow.md)
- [Task contract WEB-001](docs/tasks/WEB-001-bootstrap.md)
