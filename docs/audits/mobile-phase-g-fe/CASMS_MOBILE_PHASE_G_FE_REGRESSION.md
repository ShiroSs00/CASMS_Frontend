# CASMS Mobile Phase G — FE_REGRESSION

Ngày 25/11/2026 (Asia/Saigon). FE a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43, main/origin/main, cộng working tree B/C/D/E0/F được bảo toàn. BE 0bc2b3831301a0d67d45bacc120a161dbacec026 chỉ đọc; ?? qa/ có từ trước. Chỉ Mobile và tài liệu liên quan. Không dependency mới/upgrade, BE/DB/Web mutation, prebuild, commit hoặc push.

Bằng chứng trong G là STATIC_VERIFIED và unit/contract/export; **RENDERED_UI_BLOCKED**. Không có screenshot sản phẩm mới, TalkBack/VoiceOver, Real API hoặc Device E2E pass. Fixture không chứng minh Backend QA.

Baseline189/189 được giữ. Bộ cuối198/198 (thêm4 SSE +3 UI/layout/contrast/static contract +2 display-clock), không skip/todo hoặc giảm assertion. SSE subset13/13 nằm trong198. Logs chuẩn: evidence/{tests,typecheck,lint,doctor,dependency-check,export,git-diff-check}.txt; verification.json tổng hợp exit status sau check cuối.

Typecheck/lint và Expo export Android/iOS/Web là gate bắt buộc; chỉ kết luận khi final log complete. Expo install --check online giữ đúng11 mismatch cũ; Doctor19/20 chỉ version check fail, không exclude/fix dependency. Sandbox offline map ban đầu nói up-to-date không được dùng làm nghiệm thu; online log thay thế. Advisory B chưa chạy audit lại, không tuyên bố fixed.

Initial export bắt đầu trước khi source-freeze nên Metro file map chưa thấy file foreground-clock vừa tạo; lần đó fail resolve. Không sửa assertion/exclude để né. Đã chạy lại --clear sau source-freeze, final export.txt là bằng chứng quyết định; export-initial.txt giữ provenance. Không coi lỗi mid-edit này là kết quả final pass.

Coverage giữ: A0/A restore/deep links/owner/API/epoch; B claim/QR expiry/cardreader; C mutation preflight/slot/quota/operationjournal/recovery; D POS lifecycle/fulfillment/sale/idempotency/sessionclose/statement; E0 decimal/null/currency/noFolio; F Today/exact stop/notification schema/navigation/model metadata; G healthy idle/reconnect, width/fontScale, contrast, clock lifecycle.

Không test RealAPI, QR/NFC hardware, rendered/SR/native lifecycle, large dataset memory/FPS. Typecheck/lint/unit/export không đóng các gate này. Git diff --check bao gồm working tree cũ; BE status vẫn ?? qa/; Web không có diff do G. Không commit/push.

## Kết quả cuối đã xác nhận

| Check | Exit / result |
|---|---|
| npm run typecheck | 0 / PASS |
| npm run lint | 0 / PASS, 0 errors/warnings |
| npm test | 0 / 198 pass, 0 fail/skip/todo |
| SSE subset | 13 pass trong198, fake stream/timers |
| expo install --check online | 1 / đúng11 mismatch nền |
| expo-doctor | 1 / 19/20, chỉ version check |
| Expo export Android/iOS/Web sau source-freeze | 0 / PASS,36 static routes |
| git diff --check | 0 / PASS |
| Rendered / RealAPI / NFC / screen reader | BLOCKED hoặc NOT_RUN, không PASS |

21 tệp quan trọng thuộc Auth/POS adapters/lifecycle/session/sale/journal/QR/NFC/E0/F scope được đối chiếu hash với đầu G và giữ nguyên. Artifact scan không thấy fixture URLs hoặc __ui/emit; bare18086 nằm trong Reanimated worklet hash9106121518086, không endpoint. Chi tiết machine-readable trong verification.json.
