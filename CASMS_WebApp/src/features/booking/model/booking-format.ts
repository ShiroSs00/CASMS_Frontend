export const money=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value)
export const date=(value:string)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value+'T00:00:00+07:00'))
