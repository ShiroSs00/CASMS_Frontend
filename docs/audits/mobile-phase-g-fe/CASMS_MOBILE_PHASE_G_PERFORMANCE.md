# CASMS Mobile Phase G — PERFORMANCE

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Chỉ xử lý issue có source evidence. Không số phần trăm/FPS/memory improvement được công bố.

| Surface | Evidence trước | Sau / giới hạn |
|---|---|---|
| SSE silence | 45s watchdog abort kết nối không heartbeat | Handshake45s, established idle không abort, lease30min; 120s fake-clock test:1connection, REST2 lần sau baseline |
| Inbox | Full list map trong ScrollView, API không pagination | FlatList initial12, UUID keys, một scroller; all JSON vẫn được fetch/parse, không giả server pagination |
| Display clocks | useNow giữ interval ở background/inactive | Timer dừng; resume reconcile Date.now;2 lifecycle tests chứng minh cancellation/late guard |
| Query/cache | Shared keys owner/API/epoch, stale30s; F predicate excludes journals/POS/finance | Giữ dedupe ReactQuery; coalescing250ms, bounded retries5; không mutation invalidation event |
| Startup/restore | SecureStore/role/me/voyages gate, không GLB prefetch | Giữ; startup/native CPU/time chưa đo |
| Assets/model | Model metadata on-demand; local GLB F ~281MB/~182MB | Không thêm asset/renderer; M15 memory/load/dispose benchmark pending |
| Camera/NFC | Focus/AppState unsubscribe và cancelTechnologyRequest existing | Không rewrite; physical camera/NFC leak test pending |
| Motion | Existing reduced-motion provider; no new animation | Frame trace/JS thread time pending |
| Other lists | Request/activity/statement map lists; chưa có representative dataset/performance trace | Không blanket virtualize/memo; QA large dataset cần DB-04/06 |
| Bundle | dist/phase-g sau source-freeze | Bytes/modules ở evidence/bundle-metrics.json khi export complete; bytes không là native memory/TTI |

Benchmark cần Phase M: cold/warm startup→meaningful frame, session restore online/offline; thousand inbox rows scroll, large request/statement fixtures và real QA; 30min SSE + suspend/resume/token/account switch; FPS/JS/memory allocation before/after route/pop/camera/NFC, representative phone/tablet Android/iOS. Phải đo cùng build/dataset/hardware; không lấy thời gian Metro/export làm runtime performance.

## Kích thước artifact filesystem đã đo

| Platform | F bytes | G bytes | G − F bytes |
|---|---:|---:|---:|
| android | 6177427 | 6186871 | +9444 |
| ios | 5957878 | 5965374 | +7496 |
| web | 3188164 | 3194312 | +6148 |

Native là exported Hermes bytecode; Web là tổng JS chunks, không transfer gzip hoặc first-screen payload. Module counts/hash từng artifact ở verification.json/bundle-metrics.json. Đây là kích thước output, không chứng minh memory/FPS/startup cải thiện.
