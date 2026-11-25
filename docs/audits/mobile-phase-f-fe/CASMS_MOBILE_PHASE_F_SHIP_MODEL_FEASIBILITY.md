# CASMS Mobile Phase F — SHIP_MODEL_FEASIBILITY

Ngày 25/11/2026. FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main + working tree B/C/D/E0 được giữ; BE0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc (?? qa/ từ trước). Baseline171 tests, typecheck/lint/export pass, Doctor19/20 và11 mismatch nền. Đọc AGENTS/OceVie Mobile, báo cáo0/A0/A/B/C/D/E0, handoff và source hiện tại; không dùng báo cáo thay contract. Chỉ sửa Mobile/tài liệu, không BE/DB/Web, SQL/seed/Maven, dependency mới, commit/push hoặc Folio/checkout. Áp dụng7 skill bắt buộc và frontend-testing-debugging, chi tiết SKILL_USAGE. Evidence là source/unit/contract/export trừ khi ghi rõ rendered; chưa có QA BE/DB xác nhận.

Source đọc: PublicShipModelController/ShipModelAssetService/PublicShipModelResponse/ShipModelCabinMappingRequest, ShipController/Deck DTO; WebBooking model.ts/ModelCanvas/scene (DOM Three.js), Mobile Destination/passengerApi.decks; local Model3d outputs chỉ tham chiếu. File F thêm ship-information.ts và sửa PassengerDestinationScreen, không sửa Web/Model3d hoặc thêm renderer dependency.

Public endpoint chỉ latest READY trên operational ship; response shipId/modelId UUID/manifest/cabinMappings. Asset URL rechecks publication mỗi lần và GLB allowlist, no-store. F validate selected ship UUID, manifest fields và asset path không URL/traversal; metadata đọc khi user bấm trên Destination, không Home. Cache private query key gồm API/owner/epoch/ship; intent còn gắn BP, đổi context không giữ yêu cầu cũ. Model metadata có name/revision, UI nói rõ chưa có sơ đồ tương tác, không tự gán vị trí cabin/deck/tiện ích. Deck/cabin text từ current booking/cruise/deck API, exact ship validation; missing cabin/deck không suy đoán.

Số đo LOCAL REFERENCE, chưa xác nhận Backend công bố hai model cho selected ship. Evidence ship-model-local-metrics.json đọc file stat và GLB JSON/image headers; không tải model qua Backend, không benchmark thiết bị:

| Model local | Full GLB bytes | Tổng GLB bundles bytes | GLB files / meshes | Physical manifest |
|---|---:|---:|---|---|
| Carnival Conquest |280894644 (~281MB decimal)|595625024|17 /1872|13 decks,305 cabins,102 areas |
| MS Zaandam |182231588 (~182MB)|379886892|14 /1376|10 decks,291 cabins,64 areas |

Cả hai glTF2.0, units metre, revision v11-casms-draft tại local. Mỗi full GLB có2 texture PNG512×512, tổng RGBA8 không mipmap khoảng2MiB; encoded images khoảng0.44MB. Buffer geometry:278965692 và180753684 bytes. Không coi revision chứa “draft” ở local là publication trạng thái DB; publication chỉ Backend READY theo ship/version.

Memory dự kiến phải đo: nếu loader giữ GLB bytes + decoded buffers + GPU upload đồng thời, scenario naïve riêng ba nhóm khoảng839MB/544MB chưa kể mesh objects/indices/runtime/renderer/mipmaps. Đây là ước lượng theo kịch bản, KHÔNG peak RAM đo thực. Không cộng mọi GLB file để khẳng định một view cần tải tất cả: có exterior/deck/service chunks; phải dùng lazy chunks phù hợp và mapping thực trước benchmark. Web viewer dùng HTMLDivElement/canvas/Three scene và full byte load; không chạy nguyên xi trên React Native dù expo-gl/webview đã có. Mobile chưa có Three.js direct renderer, không thêm package. WebView có sẵn không đồng nghĩa ứng dụng đã được duyệt mô hình nhúng/host/security/memory.

Không có2D PNG/SVG deck map được contract này công bố; public assets hiện GLB. Do đó F triển khai metadata/text, không bịa sơ đồ2D từ tên/cabin hoặc indoor navigation/GPS. Offline cache chưa có policy, không prefetch/cache nặng; modelId/revision cần invalidate khi publication đổi, no-store asset không được thay bằng cache vĩnh viễn. Không bundle GLB mặc định.

M15 OPEN. Gate cho G: QA selected ship có published model/cabin/deck/area mappings thật, asset length/version/cache revoke; benchmark Android/iOS representative devices, cold/warm load, network size, peak process/GPU memory, frame time, low-memory/rotation/background/dispose và offline behavior. Chốt budget và renderer/package/rollback trước triển khai, không tự coi GLB Web pass là native pass. Nếu không đạt, text/metadata vẫn usable. Tests wrong ship/missing/invalid path metadata pass; device benchmark NOT_RUN. Acceptance FE feasibility completed, 3D renderer BLOCKED_BY_PUBLICATION_QA/HARDWARE/BENCHMARK.
