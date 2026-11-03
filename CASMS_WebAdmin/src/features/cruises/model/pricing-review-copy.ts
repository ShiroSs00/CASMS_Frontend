import type {PricingAction} from '../api/pricing-review'

export function pricingReviewCopy(commercial:boolean,action:PricingAction){
 const subject=commercial?'thanh toán, hủy và phí':'giá cabin và điều kiện thương mại'
 const labels={submit:`Gửi ${subject} để duyệt`,approve:`Phê duyệt ${subject}`,return:`Yêu cầu chỉnh sửa ${subject}`}
 const results={submit:`Đã gửi ${subject} để xét duyệt.`,approve:`Đã phê duyệt ${subject}. Quyết định này không thay thế duyệt kế hoạch hoặc duyệt phiên bản giá Gói du thuyền.`,return:`Đã yêu cầu chỉnh sửa ${subject}, kèm lý do.`}
 return{label:labels[action],success:results[action],errorTitle:`Chưa xác nhận được thao tác đối với ${subject}`,description:action==='submit'?'Gửi đúng bản chính sách đang xem để một tài khoản Quản lý vận hành khác xét duyệt. Thao tác này không gửi kế hoạch hoặc mở bán.':commercial?'Quyết định áp dụng chung cho thanh toán, hủy, thuế và phí trong bản chính sách này. Phiên bản giá Gói du thuyền được xét duyệt riêng.':'Quyết định áp dụng cho bản chính sách giá cabin và các điều kiện thương mại đang xem, độc lập với xét duyệt kế hoạch.'}
}
