# Web architecture

Status: CONFIRMED

Source: [bootstrap plan v1.0](bootstrap-plan.md), accepted for implementation by the user on 2026-10-11.

## Shape

CASMS Web là một React application với một Vite build pipeline, chia module theo feature. WEB-001 chỉ tạo `home`; module nghiệp vụ chỉ được tạo khi contract tương ứng có nguồn product/design/API cần thiết.

| Layer | Responsibility | May import |
| --- | --- | --- |
| `app` | Router, provider, layout và composition toàn app | features qua public entry, domain qua public entry, shared, styles |
| `features/<name>` | Page, interaction, state và adapter của một use case | cùng module, domain qua public entry, shared |
| `domain/<name>` | Model/UI nghiệp vụ dùng chung | cùng domain module, shared |
| `shared` | UI cơ bản, transport, config và utility không phụ thuộc nghiệp vụ | shared và package ngoài |
| `styles` | Token, reset và nền toàn app | không chứa selector riêng của feature |

Chiều phụ thuộc là `app → features → domain → shared`. Feature không import feature khác. Domain không import app/feature hoặc domain module khác. Shared không import app/feature/domain.

## Public entries

- Code ngoài một feature/domain phải import folder public entry, ví dụ `@/features/home`.
- Deep import như `@/features/home/pages/HomePage` từ module khác bị cấm.
- Code bên trong module dùng relative import trực tiếp và không vòng qua index của chính nó.
- Public index chỉ export API thật sự cần dùng.

## Enforcement

`eslint.config.js` đăng ký rule cục bộ `architecture/boundaries`. Rule phân loại đường dẫn import alias `@/` và relative sau khi resolve về `src/`, rồi chặn:

1. feature → feature khác hoặc app;
2. domain → feature/app/domain khác;
3. shared → domain/feature/app;
4. deep import vào feature/domain từ bên ngoài module thay vì public entry.

Vite và TypeScript cùng map `@/` tới `src/`. Boundary rule áp dụng cho static import, re-export và dynamic `import()` trong TypeScript source.

## UI, state, API and CSS

- Page chỉ compose component; state nhỏ ở gần nơi dùng.
- Component hiển thị nhận typed props và không tự gọi API trừ khi trách nhiệm được contract nêu rõ.
- Endpoint nghiệp vụ nằm trong feature; transport chung mới thuộc shared.
- DTO được map tại boundary, không rải field backend qua component.
- CSS riêng dùng CSS Modules; token/reset/global ở `styles/`.
- Không tạo root `utils/`, `services/` hoặc `components/` làm nơi gom code không rõ ownership.
