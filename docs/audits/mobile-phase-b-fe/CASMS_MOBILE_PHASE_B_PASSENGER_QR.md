# CASMS Mobile Phase B — PASSENGER_QR

Baseline ngày 25/11/2026: FE `a6bd1d6b4078d33dd1cf9e23c63bcaa1fc812b43`, nhánh `main`, upstream `origin/main`; BE tham chiếu `0bc2b3831301a0d67d45bacc120a161dbacec026`. So với mốc yêu cầu 3c01db0, A0/A đã được merge ở FE a6bd1d6. Giữ nguyên các tệp untracked có từ trước. Backend có thư mục untracked qa/ từ baseline; không sửa Backend/DB/Web. Không chạy SQL, Maven, API mutation thật, prebuild, commit hoặc push trong Phase B.

Đã đọc AGENTS gốc/Mobile, OceVie Mobile, báo cáo Phase 0/A0/A và handoff; các source và thay đổi chuyên biệt ghi dưới đây. Áp dụng đủ 7 skill theo [SKILL_USAGE](CASMS_MOBILE_PHASE_B_SKILL_USAGE.md). Kết quả kiểm tra tập trung trong [FE_REGRESSION](CASMS_MOBILE_PHASE_B_FE_REGRESSION.md). Chưa có QA do BE/DB xác nhận và thiết bị NFC thật; không tuyên bố REAL_API_PASSED hay DEVICE_E2E_PASSED.

Đọc route passenger-qr, PassengerLiveHome/PassengerAccount, voyage context, API/hook/type và PassengerCardService. Sửa route và passenger-api; thêm PassengerCardScreen/card-contracts.

Trước: placeholder hướng dẫn quầy. Sau: request đúng BookingPassenger, GET kiểm lại BoardingReady trước POST claim; QR encode đúng code server, không JWT/UUID/chuỗi do FE tạo. Renderer react-native-qrcode-svg 6.3.54 đã được duyệt, dùng SVG hiện có. QR tương phản midnight/white, quiet zone, co theo chiều rộng, hướng dẫn đến quầy và countdown theo expiresAt. Đổi mã là thao tác rõ ràng của người dùng, không tự renew.

State có chưa đủ điều kiện/loading/chưa yêu cầu/pending/còn hiệu lực/hết hạn/rejected/assigned server error/offline/session expired qua guard và ErrorNotice. Chỉ show QR khi context/check-in vẫn hợp lệ. Assignment chỉ ghi nhận khi Backend trả PASSENGER_CARD_ALREADY_ASSIGNED; không suy ra từ hết hạn hoặc QR biến mất.

Claim chỉ lưu state màn hình; mutation trả void nên không lưu code trong TanStack mutation data. Không persistence/log/analytics. Cleanup blur/background/unmount, timer expiry; route remount theo API URL/owner/epoch/booking/BookingPassenger/cruise. Generation loại response đến muộn. Foreground không phục hồi mã cũ; phải yêu cầu mã mới. Không đưa code thật vào tài liệu/screenshot.

M02 source đã xử lý. Projection đã cấp thẻ còn BE-08 OPEN; không thể tự cập nhật Passenger ngay khi quầy cấp thẻ nếu server chưa trả evidence. QR scan/dynamic text trên máy thật chưa nghiệm thu.
