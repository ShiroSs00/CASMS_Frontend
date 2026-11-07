import { servicePurchaseFlags, type CatalogItem, type CatalogKind, type ServiceUsagePolicy } from './catalog'
export const packageTypes: Record<string, string> = { BASIC: 'Cơ bản', PLUS: 'Plus', PREMIUM: 'Cao cấp', PREMIUM_PLUS: 'Cao cấp Plus', ADVANCED: 'Nâng cao', ADD_ON: 'Bổ sung (Extra)' }
// Values present in the backend catalog seed; additional persisted values are merged by the form.
export const serviceTypes: Record<string, string> = { DINING: 'Ẩm thực', BEVERAGE: 'Đồ uống', INTERNET: 'Internet', WELLNESS: 'Chăm sóc sức khỏe', SPA_WELLNESS: 'Spa & chăm sóc sức khỏe', SHORE_EXCURSION: 'Tham quan bờ', ENTERTAINMENT_ACTIVITY: 'Giải trí & hoạt động', PHOTOGRAPHY: 'Nhiếp ảnh', CABIN_SERVICE: 'Dịch vụ cabin', LAUNDRY: 'Giặt là', CHILDCARE_FAMILY: 'Trẻ em & gia đình', MEDICAL_ASSISTANCE: 'Hỗ trợ y tế', TRANSPORTATION: 'Đưa đón' }
export const productTypes: Record<string, string> = { SOUVENIR: 'Quà lưu niệm' }

type PurchaseFlag = keyof typeof servicePurchaseFlags
const purchaseFlags = Object.keys(servicePurchaseFlags) as PurchaseFlag[]
export type CatalogDraft = Record<PurchaseFlag, string> & { preCruiseUsagePolicy: ServiceUsagePolicy | ''; preCruiseUsageLimit: string; usageTimeZone: string; requiresSchedule:string;categoryId:string;unitCode:string; code: string; name: string; description: string; type: string; price: string; currency: string; capacity: string; startDate: string; endDate: string }
export const emptyCatalogDraft: CatalogDraft = {canBuyPreCruise:'',canBuyOnboard:'',canSellIndependently:'',preCruiseUsagePolicy:'',preCruiseUsageLimit:'',usageTimeZone:'',requiresSchedule:'',categoryId:'',unitCode:'', code: '', name: '', description: '', type: '', price: '', currency: '', capacity: '', startDate: '', endDate: '' }
export function catalogDraft(item: CatalogItem): CatalogDraft {
  const choice = (value: boolean | undefined) => value == null ? '' : String(value)
  return {canBuyPreCruise:choice(item.canBuyPreCruise),canBuyOnboard:choice(item.canBuyOnboard),canSellIndependently:choice(item.canSellIndependently),
    preCruiseUsagePolicy:item.preCruiseUsagePolicy??'',preCruiseUsageLimit:item.preCruiseUsageLimit?.toString()??'',usageTimeZone:item.usageTimeZone??'',requiresSchedule:item.requiresSchedule===true?'true':item.requiresSchedule===false?'false':'',categoryId:item.categoryId??'',unitCode:item.unitCode??'', code: item.code, name: item.name, description: item.description ?? '', type: item.type, price: item.price == null ? '' : String(item.price), currency: item.currency ?? '', capacity: item.capacity == null ? '' : String(item.capacity), startDate: item.startDate ?? '', endDate: item.endDate ?? '' }
}
export function validateCatalogDraft(kind: CatalogKind, draft: CatalogDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.code.trim().length > 50) errors.code = 'Mã tối đa 50 ký tự.'
  if (!draft.name.trim() || draft.name.trim().length > 200) errors.name = 'Tên bắt buộc, tối đa 200 ký tự.'
  if (!draft.type.trim() || (kind === 'packages' ? !Object.hasOwn(packageTypes, draft.type) : draft.type.trim().length > 50)) errors.type = 'Chọn hoặc nhập loại hợp lệ, tối đa 50 ký tự.'
  if (draft.description.length > 1000) errors.description = 'Mô tả tối đa 1000 ký tự.'
  if ((kind !== 'services' && !draft.price.trim()) || (draft.price.trim() && (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0))) errors.price = 'Giá phải là số không âm.'
  if (draft.currency.trim() && !/^[A-Z]{3}$/.test(draft.currency.trim())) errors.currency = 'Mã tiền tệ gồm 3 chữ cái in hoa.'
  if (kind === 'services' && draft.capacity.trim() && (!Number.isSafeInteger(Number(draft.capacity)) || Number(draft.capacity) < 1 || Number(draft.capacity) > 2147483647)) errors.capacity = 'Sức chứa là số nguyên lớn hơn 0.'
  if (kind === 'packages') {
    for (const field of ['startDate', 'endDate'] as const) if (draft[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(draft[field]) || !Number.isFinite(Date.parse(draft[field])) || new Date(draft[field]).toISOString().slice(0, 10) !== draft[field])) errors[field] = 'Chọn ngày hợp lệ.'
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) errors.endDate = 'Ngày hết hạn phải từ ngày bắt đầu trở đi.'
  }
  if(kind==='services'&&draft.unitCode.length>30)errors.unitCode='Đơn vị tối đa 30 ký tự.'
  if (kind === 'services') {
    if (draft.canBuyPreCruise === 'false' && draft.canBuyOnboard === 'false') errors.canBuyPreCruise = 'Chọn ít nhất một giai đoạn phục vụ.'
    if (draft.preCruiseUsagePolicy === 'PER_DAY' && draft.requiresSchedule !== 'true') errors.requiresSchedule = 'Định mức theo ngày cần lịch đặt dịch vụ.'
    if (draft.preCruiseUsagePolicy && draft.preCruiseUsagePolicy !== 'UNLIMITED') {
      const limit = Number(draft.preCruiseUsageLimit)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2147483647) errors.preCruiseUsageLimit = 'Nhập định mức nguyên dương.'
    }
    if (draft.usageTimeZone.trim()) {
      try { new Intl.DateTimeFormat('vi-VN', { timeZone: draft.usageTimeZone.trim() }) }
      catch { errors.usageTimeZone = 'Nhập mã múi giờ IANA hợp lệ.' }
    }
  }
  return errors
}
export function serializeCatalogDraft(kind: CatalogKind, draft: CatalogDraft) {
  const money = draft.price.trim() ? Number(draft.price) : null
  const description = draft.description.trim() || null
  const currencyCode = draft.currency.trim() || null
  if (kind === 'services') return {
    ...Object.fromEntries(purchaseFlags.filter(key => draft[key] !== '').map(key => [key, draft[key] === 'true'])),
    preCruiseUsagePolicy: draft.preCruiseUsagePolicy || undefined,
    preCruiseUsageLimit: !draft.preCruiseUsagePolicy ? undefined : draft.preCruiseUsagePolicy === 'UNLIMITED' ? null : Number(draft.preCruiseUsageLimit),
    usageTimeZone: draft.usageTimeZone.trim() || undefined,
    requiresSchedule:draft.requiresSchedule===''?undefined:draft.requiresSchedule==='true',categoryId:draft.categoryId||undefined,unitCode:draft.unitCode.trim()||undefined, serviceName: draft.name.trim(), serviceType: draft.type.trim(), description, price: money, currencyCode, capacity: draft.capacity.trim() ? Number(draft.capacity) : null }
  if (kind === 'products') return { productCode: draft.code.trim(), productName: draft.name.trim(), productType: draft.type.trim(), description, unitPrice: money, currencyCode }
  return { packageName: draft.name.trim(), packageType: draft.type, description, price: money, currencyCode, startDate: draft.startDate || null, endDate: draft.endDate || null }
}
export function catalogMatchesDraft(kind:CatalogKind,item:CatalogItem,draft:CatalogDraft) {
  if(item.name!==draft.name.trim()||item.type!==draft.type.trim()
    ||(item.description??'')!==draft.description.trim()
    ||item.price!==(draft.price.trim()?Number(draft.price):kind==='services'?0:null)
    ||(item.currency??'')!==draft.currency.trim())return false
  if(kind==='services')return (item.capacity??null)===(draft.capacity.trim()?Number(draft.capacity):null)
    &&(!draft.requiresSchedule||item.requiresSchedule===(draft.requiresSchedule==='true'))
    &&(!draft.categoryId||item.categoryId===draft.categoryId)
    &&(!draft.unitCode.trim()||item.unitCode===draft.unitCode.trim())
    && purchaseFlags.every(key => draft[key] === '' || item[key] === (draft[key] === 'true'))
    && (!draft.preCruiseUsagePolicy || item.preCruiseUsagePolicy === draft.preCruiseUsagePolicy
      && (item.preCruiseUsageLimit ?? null) === (draft.preCruiseUsagePolicy === 'UNLIMITED' ? null : Number(draft.preCruiseUsageLimit)))
    && (!draft.usageTimeZone.trim() || item.usageTimeZone === draft.usageTimeZone.trim())
  return kind!=='packages'||(item.startDate??'')===draft.startDate&&(item.endDate??'')===draft.endDate
}
export const catalogPermission = (kind: CatalogKind, action: 'create' | 'update' | 'delete') => kind === 'services' ? { create: 'SERVICE_CREATE', update: 'SERVICE_UPDATE', delete: 'SERVICE_DELETE_UNUSED' }[action] : kind === 'products' ? 'PRODUCT_MANAGE' : 'TOUR_PACKAGE_MANAGE'
export function catalogActions(kind: CatalogKind, status: string): { action: 'activate' | 'suspend' | 'discontinue' | 'deactivate'; label: string; permission: string }[] {
  if (kind === 'services') return status === 'INACTIVE' ? [{ action: 'activate', label: 'Kích hoạt dịch vụ', permission: 'SERVICE_ACTIVATE' }] : status === 'ACTIVE' ? [{ action: 'suspend', label: 'Tạm ngừng dịch vụ', permission: 'SERVICE_SUSPEND' }] : []
  if (kind === 'products') return status === 'INACTIVE' ? [{ action: 'activate', label: 'Kích hoạt sản phẩm', permission: 'PRODUCT_MANAGE' }] : status === 'ACTIVE' ? [{ action: 'discontinue', label: 'Ngừng cung cấp', permission: 'PRODUCT_MANAGE' }] : []
  return ['DRAFT', 'INACTIVE'].includes(status) ? [{ action: 'activate', label: 'Kích hoạt gói', permission: 'TOUR_PACKAGE_MANAGE' }] : status === 'ACTIVE' ? [{ action: 'deactivate', label: 'Ngừng áp dụng gói', permission: 'TOUR_PACKAGE_MANAGE' }] : []
}
