// Legacy preview amounts have no approved USD price; never relabel or convert them.
export const money=(value:number)=>Number.isFinite(value) ? 'Giá minh họa chưa được đối chiếu USD' : 'Chưa có thông tin giá'
export const date=(value:string)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value+'T00:00:00+07:00'))
