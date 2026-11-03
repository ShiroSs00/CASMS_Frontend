import type {ResourceType, Inclusion} from './api'

export const lifecycle: Record<string,string> = { DRAFT:'Đang soạn', PUBLISHED:'Đã phát hành', SUPERSEDED:'Đã có phiên bản mới', SUBMITTED:'Đang chờ duyệt', APPROVED:'Đã duyệt', RETURNED:'Đã trả lại' }
export const resourceLabels: Record<ResourceType,string> = { ACTIVITY:'Hoạt động trên tàu', EXCURSION:'Tour bờ', SERVICE:'Dịch vụ' }
export const inclusionLabels: Record<Inclusion,string> = { INCLUDED:'Đã bao gồm', LIMITED_INCLUDED:'Bao gồm có giới hạn', OPTIONAL:'Tùy chọn mua thêm', NOT_INCLUDED:'Không bao gồm' }
