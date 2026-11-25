# FE dependency maintenance — ngoài scope C

| ID / priority / status | Evidence | Việc cần làm / acceptance |
|---|---|---|
| FE-C-DEP-01 / P2 / OPEN | Expo Doctor B và C 19/20; expo install --check online nêu 11 package nền thấp hơn khuyến nghị SDK58. | Duyệt đợt maintenance riêng; cập nhật có kế hoạch và chạy auth/voyage/QR/NFC/service regression + native builds. Không thêm exclude để che mismatch. |
| FE-C-DEP-02 / P2 / OPEN | npm install Phase B báo 11 advisories (10 moderate, 1 high); Phase C không cài package và không chạy audit-fix. Chưa khẳng định nguyên nhân hay exploitability. | Kiểm npm audit của lock trong đợt maintenance, phân loại direct/transitive/runtime/dev; fix trong phạm vi được duyệt, không --force, chứng minh regression. |

Các mismatch giữ nguyên: @expo/ui58.0.27/~58.0.29; expo58.0.23/~58.0.26; constants58.0.15/~58.0.16; font58.0.11/~58.0.12; linking58.0.16/~58.0.17; router58.0.30/~58.0.32; secure-store58.0.2/~58.0.3; splash-screen58.0.13/~58.0.14; status-bar58.0.4/~58.0.5; symbols58.0.4/~58.0.5; web-browser58.0.7/~58.1.0 (found/expected). Không đổi package.json/lock trong C.


### Xác minh lại Phase D-FE — 25/11/2026

FE-C-DEP-01 giữ P2/OPEN: `expo install --check` online tiếp tục báo đúng 11 mismatch ở trên; Expo Doctor 19/20, check version fail. Phase D không cài/nâng package, không thêm exclude. FE-C-DEP-02 giữ P2/OPEN theo evidence B, không suy ra advisories đã được xử lý vì export pass. Đợt maintenance riêng vẫn cần auth/voyage/QR/NFC/service/POS journal regression và native build. Không tạo finding trùng.


### Xác minh Phase E0-FE — 25/11/2026

FE-C-DEP-01/02 giữ OPEN. E0 không thêm/nâng package hoặc chạy audit fix; expo install --check tiếp tục đúng11 mismatch nền. Doctor và regression evidence ở mobile-phase-e0-fe/evidence. Không tạo finding trùng hoặc exclude để che mismatch.


### Phase F-FE — 25/11/2026

FE-C-DEP-01/02 giữ OPEN. Doctor19/20 và expo install --check đúng11 mismatch nền; không cài/nâng package/exclude/audit-fix. F dùng expo/fetch hiện có, không SSE/push/3D dependency mới. SDK/ADB/Pixel_8 có nhưng UI ExpoGo load chưa pass; maintenance/native runtime được nghiệm thu riêng với QR/NFC/POS/F/financial regression. Evidence ở mobile-phase-f-fe/evidence.

### Phase G-FE — 25/11/2026

| ID / priority / status | Evidence | Công việc Phase M / acceptance |
|---|---|---|
| FE-C-DEP-01 / P2 / OPEN | Online expo install --check đúng11 mismatch; Doctor19/20. Offline map ban đầu không là version evidence. Package/lock không đổi trong G. | Maintenance riêng được duyệt; SDK58/RN0.88 compatibility + native regression, không exclude/fix-force. |
| FE-C-DEP-02 / P2 / OPEN | Advisories B11 (10moderate/1high) là historical evidence; G không npm audit lại hoặc sửa lock. | Audit lock thực tế, phân loại direct/transitive/dev/runtime và remediations được duyệt; không tuyên bố advisory đã fixed. |
| FE-G-RUNTIME-01 / P1 / OPEN | ANDROID env trống; SDK/Pixel_8 có, host ADB boot1/Go58.0.5. Web HTTP000, IAB attach timeout2 lần; không product UI. | Xác minh Metro/host/emulator connectivity, build profile/JDK/Gradle/dev-client/module plugin và approved native binary; không tự cài APK/SDK/prebuild hoặc đổi firewall. Phối hợp M13; phone/tablet/keyboard/Back/SR screenshots thật. |
| FE-G-NFC-01 / P1 / OPEN | NFC4.3.0 source/config từ B; Go/Web unavailable chủ ý, chưa native build/physical read. | Approved dev build Android/iOS + supported NFC device; permission/cancel/background/tag formats/claim preview-confirm/lookup và teardown. Giữ BE-08/09/14. |
| FE-G-SSE-01 / P1 / OPEN runtime | G sửa source healthy idle;13 SSE unit tests, không native/proxy producer evidence. | BE-10 OPEN: healthy idle/30min close/JWT refresh/resume/owner switch/emitter cap/proxy/producer→GET; không heartbeat giả/replay writes. |
| FE-G-PERF-01 / P2 / OPEN benchmark | G virtualized inbox, pause background clock; không TTI/FPS/memory trace thực tế. | Representative phone/tablet build + DB-04/06 dataset lớn; cold/warm startup/restore/scroll/JS/memory/background/listener cleanup. Không % improvement khi chưa đo. |
| M15 reference / P2 / OPEN | F local GLB~281MB/~182MB; G không renderer/autoGLB. | Published asset sizing/mapping/cache + physical memory/load/frame/dispose benchmark trước 3D; không mở renderer trong G/M readiness. |

G source fixes không đóng maintenance/native/BE/DB findings. Native app hiện light/portrait và predictiveBackGestureEnabled=false; Phase M review cấu hình/Back trên approved build, không đổi orientation toàn app để làm tablet test. Không triển khai Phase M/H trong G.
