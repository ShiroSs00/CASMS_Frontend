# CASMS Web documentation index

Last reviewed: 2026-10-11

## Trạng thái

- `CONFIRMED`: có nguồn được người dùng chấp thuận hoặc là cấu hình kỹ thuật đã kiểm chứng trong repo.
- `PROPOSED`: dùng tạm để tiến hành phần độc lập, chưa phải quyết định sản phẩm/thiết kế chính thức.
- `UNCONFIRMED`: thiếu nguồn có thẩm quyền; không được suy đoán hành vi phụ thuộc.

Hai tài liệu đầu vào bên ngoài có cùng SHA-256 `B167EA3B5CA6A4E1B8141A5E459B514BDC7E20DF8355535D3AA15476C1DD4CAA`. Bản canonical trong repo là [engineering/bootstrap-plan.md](engineering/bootstrap-plan.md); các task sau không phụ thuộc vào bản ngoài repo.

## Index

| Source | Status | Authority |
| --- | --- | --- |
| [engineering/bootstrap-plan.md](engineering/bootstrap-plan.md) | CONFIRMED | Seed lịch sử và contract bootstrap WEB-001 |
| [engineering/architecture.md](engineering/architecture.md) | CONFIRMED | Layer, module và import boundaries đang áp dụng |
| [engineering/module-map.md](engineering/module-map.md) | CONFIRMED | Module đã tồn tại và nguồn/check liên quan |
| [engineering/development.md](engineering/development.md) | CONFIRMED | Runtime, dependency và lệnh thực tế |
| [engineering/testing.md](engineering/testing.md) | CONFIRMED | Validation theo loại thay đổi |
| [engineering/git-workflow.md](engineering/git-workflow.md) | CONFIRMED | Branch, commit, push, Pull Request và merge policy |
| [decisions/ADR-001-feature-modules.md](decisions/ADR-001-feature-modules.md) | CONFIRMED | Lý do chia module theo feature |
| [decisions/ADR-002-routing.md](decisions/ADR-002-routing.md) | CONFIRMED | React Router là routing standard |
| [tasks/WEB-001-bootstrap.md](tasks/WEB-001-bootstrap.md) | DONE | Phạm vi và completion evidence của WEB-001 |
| [tasks/TEMPLATE.md](tasks/TEMPLATE.md) | CONFIRMED | Mẫu task contract |
| [product/scope.md](product/scope.md) | UNCONFIRMED | Actor, feature và out-of-scope sản phẩm |
| [product/business-rules.md](product/business-rules.md) | UNCONFIRMED | Business rules và ngoại lệ |
| [product/glossary.md](product/glossary.md) | UNCONFIRMED | Thuật ngữ nghiệp vụ |
| [design/design-system.md](design/design-system.md) | PROPOSED | Ghi nhận token tạm; thiết kế chính thức chưa có |
| [design/screen-map.md](design/screen-map.md) | UNCONFIRMED | Mapping màn hình, route sản phẩm và Figma |
| [api/contract.md](api/contract.md) | UNCONFIRMED | Endpoint, schema, lỗi và auth |

Khi nhập nguồn mới, ghi source/link, revision hoặc ngày, người xác nhận nếu có, và một trong ba trạng thái trên. Tài liệu cũ chưa đối chiếu không tự trở thành authoritative.
