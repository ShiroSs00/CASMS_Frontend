# CASMS Mobile Phase A-FE

**Kết luận FE_READY_WITH_EXTERNAL_BLOCKERS.**

Baseline FE `3c01db0` cùng working tree A0-FE chưa commit, BE `0bc2b38`. Local main, upstream tracking và remote GitHub trùng. Ngày 24/11/2026.

Đã đọc Phase 0/A0-FE, AGENTS, OceVie, tài liệu Expo SDK 58, các màn và adapter Mobile, source Auth/Booking/Itinerary của BE và Web activation. A0-FE vẫn là nền đang dùng. Phase A-FE giải quyết ba lỗi chính: login trước restore và route intent bị mất, lựa chọn chuyến mơ hồ dùng hàng đầu, và Home/Account hiển thị thiếu dữ liệu hoặc dữ liệu mặc định khi DTO khuyết.

| Trước | Sau |
|---|---|
| Login → chuyển route mà chưa xác minh dữ liệu người dùng/chuyến | Role landing và deep link nội bộ theo workspace. Passenger xác minh /auth/me và /itineraries/mine trước landing theo grant. |
| Chọn hàng đầu cùng mức ưu tiên, dựa vào account name hoặc fallback tàu | Giữ exact pair và yêu cầu chọn khi đồng hạng. Kiểm /booking/{id}, /cruise/{id}, hồ sơ Passenger và itinerary theo chuyến. Home/Account dùng dữ liệu thật và có trạng thái lỗi/trống. |
| A0 đã gắn phiên với API URL nhưng chưa lưu chuyến được chọn | Native khôi phục lựa chọn theo backend, owner và epoch, xác minh lại từ server. Logout xóa selection và cache. |
| 108/108 test FE | 122/122 pass. TypeScript, lint, Expo dependency map offline và export Android/iOS/Web pass. |
| Bị chặn QA, activation và thiết bị | M08 và QA dataset vẫn mở. Không thực hiện HTTP QA. Expo Doctor chưa có cache; adb chưa khả dụng. |

## Tệp Phase A-FE

Các tệp dưới đây nằm dưới `CASMS_MobileApp/`. Tệp A0-FE có thể cùng tên và bao gồm diff chưa commit của cả hai phase.

| Nhóm | File |
|---|---|
| Routes & launch | `src/app/_layout.tsx`, `src/app/login.tsx`, `src/app/(passenger)/_layout.tsx`, `src/features/launch/PassengerLaunchScreen.tsx`, `src/features/launch/PassengerLoadingScreen.tsx`, `src/features/pos/PosLayout.tsx` |
| Authentication | `src/features/auth/{login-model,session-model,session-store,workspace-navigation}.ts`, `src/features/auth/PassengerLoginScreen.tsx`, `src/features/auth/PassengerAccountScreen.tsx` |
| Passenger context | `src/features/passenger-actions/{passenger-api,passenger-hooks,passenger-model,passenger-types,voyage-selection}.ts`, `AccountBoundScreen.tsx` và `PassengerActionUI.tsx` trong cùng feature, `src/features/notifications/PassengerNotificationsScreen.tsx` |
| Voyage UI | `src/features/itinerary/{itinerary-api,itinerary-client}.ts`, `src/features/itinerary/{ItineraryUI,PassengerLiveItineraryScreen}.tsx`, `src/features/home/{PassengerLiveHomeScreen,PassengerDestinationScreen,PassengerVoyageChooser,VoyageHomeParts}.tsx`, `src/features/home/voyage-home-model.ts`, `src/hooks/use-now.ts` |
| Kiểm thử | `tests/{auth-restore,phase-a-voyage,live-api,passenger-actions,session-cleanup}.test.mjs` |

Hai handoff A0-FE được cập nhật tại chỗ, giữ các finding đang mở. Các skill đã dùng gồm expo-router, expo-data-fetching, expo-native-ui, expo-design-system, ui-ux-pro-max, impeccable và frontend-design.

## Báo cáo và điều kiện sang Phase B-FE

- [Triển khai](CASMS_MOBILE_PHASE_A_FE_IMPLEMENTATION.md)
- [Auth/session](CASMS_MOBILE_PHASE_A_AUTH_SESSION.md)
- [Navigation](CASMS_MOBILE_PHASE_A_NAVIGATION.md)
- [Voyage Context](CASMS_MOBILE_PHASE_A_VOYAGE_CONTEXT.md)
- [Home và Account](CASMS_MOBILE_PHASE_A_PASSENGER_HOME.md)
- [UI/UX Native](CASMS_MOBILE_PHASE_A_UI_UX_REVIEW.md)
- [Kiểm hồi quy](CASMS_MOBILE_PHASE_A_FE_REGRESSION.md)
- [Skills](CASMS_MOBILE_PHASE_A_SKILL_USAGE.md)
- [Backend handoff](../mobile-phase-a0-fe/CASMS_BACKEND_HANDOFF.md) và [Database handoff](../mobile-phase-a0-fe/CASMS_DATABASE_HANDOFF.md)

**Có thể chuyển sang các hạng mục B-FE có contract đã xác nhận.** Cổng nghiệm thu Web activation → Mobile login → voyage thật còn phụ thuộc M08 và QA do BE/DB cung cấp. B-FE còn cần xác nhận phạm vi check-in/card và kiểm thiết bị. Phase A-FE đã kiểm FE độc lập; kết quả không chứng nhận tích hợp thật.
