# CASMS Mobile Phase B — UI_UX_REVIEW

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đọc OceVie Mobile, PassengerButton/PassengerUI/Scaffold, layout/Notice/ConfirmAction và các màn liên quan. Tái dùng những primitive này; không thêm UI library hoặc thay design system. QR white quiet zone, countdown không live-announce mỗi giây; accessible label không chứa raw code. Touch target/safe area/reduced motion thừa hưởng primitive. Scanner frame dùng token hiện có; label phân biệt preview, native reading và server assignment.

QR có card identity/chuyến/tàu/cabin, một primary action theo giai đoạn. POS tra cứu tách khỏi cấp thẻ và không phụ thuộc camera permission. Confirm sheet nêu tên người nhận; UID không hiện, không cho nhập tay. Loading/empty/error/permission/network/pending/expiry và assigned có copy. Không thêm animation mới.

Review source STATIC_VERIFIED; chưa render tương tác có QA auth, chưa đo QR ngoài thiết bị hoặc nghiệm thu font lớn, keyboard/Hardware Back, TalkBack/VoiceOver, tablet, native NFC sheet. Không tạo screenshot có code nhạy cảm. Acceptance UI source sẵn sàng, device UX còn BLOCKED_BY_HARDWARE. Không thay toàn bộ app hoặc Web.
