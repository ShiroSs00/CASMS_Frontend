# Design system

Status: PROPOSED for WEB-001 shell tokens; official product design remains UNCONFIRMED.

Source: hướng navy–kem–vàng trong [bootstrap plan](../engineering/bootstrap-plan.md). Chưa có Figma, brand guideline hoặc token export được xác nhận tính đến 2026-10-11.

## WEB-001 temporary tokens

Các biến trong `src/styles/tokens.css` chỉ hỗ trợ technical shell:

- Navy cho nền và surface.
- Cream cho text chính.
- Gold cho accent và focus.
- System sans + Georgia fallback cho heading.
- Spacing, radius, shadow và content width tối thiểu.

Tất cả giá trị cụ thể là `PROPOSED`, không phải token thương hiệu chính thức. Task UI tiếp theo phải đối chiếu nguồn thiết kế được xác nhận trước khi giữ hoặc thay chúng.

## Baseline UI behavior

- CSS Modules cho layout/component; global CSS chỉ reset và style nền.
- Focus rõ bằng `:focus-visible`.
- Layout phải không tràn ngang ở 375 px và 1440 px.
- Loading, empty, error và interaction state chỉ được bổ sung khi task/nguồn tương ứng xác định hành vi.
