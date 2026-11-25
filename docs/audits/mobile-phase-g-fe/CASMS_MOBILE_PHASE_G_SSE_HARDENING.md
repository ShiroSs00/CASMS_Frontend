# CASMS Mobile Phase G — SSE_HARDENING

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Contract được đọc lại từ CASMS_Backend/src/main/java/com/casms/notification/service/NotificationSseHub.java: SSE_TIMEOUT_MS=30L*60L*1000L, max3 emitters/user, connected frame, completion/timeout/error cleanup; không heartbeat/replay. FE NotificationSync/app-query-focus/session-store/notification-queries/tests cũng được đọc lại.

G-01 xác nhận lỗi: idle watchdog45s được reset trên bytes; healthy connection không có business event vẫn abort, tiêu5attempt rồi fallback. G tách handshake: từ connect cần valid connected trong45s. Headers/body/comment/malformed frame không tự chứng minh established. Khi valid connected, clear handshake; business silence không network failure. Timer lease30min theo source contract bảo đảm rotation kể cả network half-open; không heartbeat giả. Server EOF/error/lease abort đều reconcile GET rồi bounded retry.

Budget: tối đa5 lần liên tiếp với backoff1/2/4/8sec jitter0.8–1.2. Accepted stream đóng ngay không reset attempts; stable60s (cùng cadence REST freshness) mới reset. Một stream thành công hàng chục phút không tiêu cả lifetime budget. Repeated connected chỉ xử lý một lần; coalesce250ms, dedupe256; REST60s vẫn chạy foreground vì impact producer có thể không publish. Không event→POST.

JWT refresh/owner/API/epoch/background đổi effect cleanup abort/cancelreader/timers; foreground mới xác minh current token/context rồi nối lại; invalidation predicate không chạm POS/Folio/journal. 401/403 stop retries/poll và invalidate me theo behavior hiện có. User-facing live chỉ nói đã kết nối khi ứng dụng mở, không tuyên bố Backend producer luôn giao đủ event.

13 SSE unit/controller tests (9 cũ giữ, rename idle test thành handshake chính xác +4 ca mới): parser/invalidframes/headerGET/coalesce/authdeny/backoff/handshake/healthyidle/malformed handshake/EOF+lease/rapidclosure/stalecallback/tokenrefresh/predicate. Đây là fake stream/timers, không native proxy test.

BE-10/M05 OPEN: proxy buffering/idle budget/JWT expiry/in-memory emitter teardown/cross-instance/producer identity/heartbeat-replay và real device SSE chưa xác nhận. REST authoritative không che Backend bug. ACK BE-21/Folio M06/M07/push BE-23 không được mở.
