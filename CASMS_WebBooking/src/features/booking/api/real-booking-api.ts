import { ApiError, apiRequest } from '@/shared/api';
import { decodeBookingContext, type BookingContext, type BookingSummary } from '@/domain/booking-context';
import { decodeCruisePackageBookingFields, type CabinSelectionMode, type CruisePackageCatalog, type CruisePackageBookingFields } from '@/domain/cruise-package';
import { financialAmount, financialFlag } from '../model/booking-financials';
export type AvailableCabin = {
    cabinId: string;
    cabinNumber: string;
    deckId: string | null;
    deckNumber: number | null;
    deckName: string | null;
    cabinType: string;
    capacity: number;
    remainingCapacity: number;
    isAccessible: boolean | null;
    priceMultiplier?: number | null;
    estimatedPrice?: number | null;
};
export type BookingListItem = BookingSummary & {
    createdAt: string | null;
    agreedFareAmount: number | null;
    currency: string | null;
    departureDatetime: string | null;
    passengerCount: number | null;
};
type BookingProfile = BookingContext['passengers'][number] & CruisePackageBookingFields & {
    dateOfBirth: string | null;
    nationality: string | null;
    email: string | null;
    phoneNumber: string | null;
};
export type BookingDetail = Omit<BookingContext, 'passengers'> & {
    passengers: BookingProfile[];
    agreedFareAmount: number;
    currency: string;
    requiredDepositAmount: number;
    totalPaidAmount: number | null;
    outstandingBalance: number | null;
    fullyPaid: boolean | null;
    finalPaymentDueAt: string | null;
    contractReference: string | null;
    contractStatus: string | null;
    paymentPlan: string | null;
    contractSigningInstructions: string | null;
    departureDatetime: string | null;
    returnDatetime: string | null;
    cancellationReason: string | null;
    installments: {
        sequenceNo: number;
        requiredAmount: number;
        paidAmount: number | null;
        outstandingAmount: number | null;
        paid: boolean | null;
        currency: string;
        dueAt: string | null;
        status: string;
        installmentType: string;
        description: string | null;
    }[];
};
export type BookingPersonDraft = {
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    documentType: '' | 'NationalID' | 'Passport';
    documentNumber: string;
    email: string;
    phoneNumber: string;
    cabinId: string;
    tourPackageId: string;
    cabinSelectionMode?: CabinSelectionMode;
    cabinGroupKey?: string;
    farePackageOfferId?: string;
    farePackagePriceRevisionId?: string;
};
export type BookingDraft = {
    cruiseId: string;
    currency: string;
    paymentPlan: 'FULL' | 'DEPOSIT' | 'STAGES';
    notes: string;
    passengers: BookingPersonDraft[];
};
export type BookingCruiseOption = {
    sellable?: boolean;
    cruiseId: string;
    cruiseCode: string;
    cruiseName: string;
    status: string;
    shipId: string | null;
    departureDatetime: string;
    returnDatetime?: string;
};
export function decodeBookingDetail(value: unknown): BookingDetail {
    const context = decodeBookingContext(value), row = value as Record<string, unknown>;
    if (['agreedFareAmount', 'requiredDepositAmount'].some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key])) || typeof row.currency !== 'string' || !Array.isArray(row.installments))
        throw new Error('Thông tin giá và hợp đồng đặt chỗ không đầy đủ.');
    if (!/^[A-Z]{3}$/.test(row.currency) || (row.agreedFareAmount as number) < 0 || (row.requiredDepositAmount as number) < 0
        || (row.paymentPlan != null && !['FULL', 'DEPOSIT', 'STAGES'].includes(String(row.paymentPlan)))
        || (row.contractStatus != null && !['Draft', 'Accepted', 'Cancelled'].includes(String(row.contractStatus)))
        || ['contractReference', 'contractStatus', 'contractSigningInstructions', 'cancellationReason'].some(key => row[key] != null && typeof row[key] !== 'string')
        || ['departureDatetime', 'returnDatetime', 'finalPaymentDueAt'].some(key => row[key] != null && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key] as string))))
        || row.installments.some(item => !item || !Number.isSafeInteger(item.sequenceNo) || item.sequenceNo < 1 || typeof item.requiredAmount !== 'number' || !Number.isFinite(item.requiredAmount) || item.requiredAmount < 0 || typeof item.currency !== 'string' || !/^[A-Z]{3}$/.test(item.currency) || !['Scheduled', 'Cancelled'].includes(item.status) || !['Deposit', 'FinalFare'].includes(item.installmentType) || (item.description != null && typeof item.description !== 'string') || (item.dueAt != null && (typeof item.dueAt !== 'string' || !Number.isFinite(Date.parse(item.dueAt))))))
        throw new Error('Thông tin giá và hợp đồng đặt chỗ không hợp lệ.');
    const passengers = context.passengers.map((person, index) => {
        const source = (row.passengers as Record<string, unknown>[])[index];
        if (['dateOfBirth', 'nationality', 'email', 'phoneNumber'].some(key => source[key] != null && typeof source[key] !== 'string')
            || (source.dateOfBirth != null && (!/^\d{4}-\d{2}-\d{2}$/.test(String(source.dateOfBirth)) || !Number.isFinite(Date.parse(String(source.dateOfBirth))) || new Date(String(source.dateOfBirth)).toISOString().slice(0, 10) !== source.dateOfBirth)))
            throw new Error('Thông tin hồ sơ hành khách không hợp lệ.');
        // Do not render or carry the Backend's protected document-number field.
        return { ...person, ...decodeCruisePackageBookingFields(source, person.bookingPassengerId, context.bookingId, context.bookingStatus), dateOfBirth: source.dateOfBirth ?? null, nationality: source.nationality ?? null, email: source.email ?? null, phoneNumber: source.phoneNumber ?? null };
    });
    financialAmount(row.agreedFareAmount); financialAmount(row.requiredDepositAmount);
    const installments = row.installments.map(item => ({
        sequenceNo: item.sequenceNo, requiredAmount: financialAmount(item.requiredAmount), currency: item.currency,
        dueAt: item.dueAt ?? null, status: item.status, installmentType: item.installmentType, description: item.description ?? null,
        paidAmount: financialAmount(item.paidAmount), outstandingAmount: financialAmount(item.outstandingAmount), paid: financialFlag(item.paid),
    }));
    if (new Set(installments.map(item => item.sequenceNo)).size !== installments.length || installments.some(item => item.currency !== row.currency))
        throw new Error('Lịch thanh toán không khớp đặt chỗ.');
    // Allowlist the detail DTO: never carry setup tokens or unrelated server fields into booking state.
    return { ...context, passengers, installments,
        agreedFareAmount: row.agreedFareAmount, currency: row.currency, requiredDepositAmount: row.requiredDepositAmount,
        totalPaidAmount: financialAmount(row.totalPaidAmount), outstandingBalance: financialAmount(row.outstandingBalance), fullyPaid: financialFlag(row.fullyPaid),
        paymentPlan: row.paymentPlan ?? null, finalPaymentDueAt: row.finalPaymentDueAt ?? null,
        contractReference: row.contractReference ?? null, contractStatus: row.contractStatus ?? null,
        contractSigningInstructions: row.contractSigningInstructions ?? null, cancellationReason: row.cancellationReason ?? null,
        departureDatetime: row.departureDatetime ?? null, returnDatetime: row.returnDatetime ?? null,
    } as BookingDetail;
}
export function serializeCabinSelection(person: BookingPersonDraft, quote = false) {
    const fare = Boolean(person.farePackageOfferId || person.farePackagePriceRevisionId || person.cabinSelectionMode === 'CATEGORY_HOLD');
    if (!fare)
        return { cabinId: person.cabinId, tourPackageId: person.tourPackageId || (quote ? null : undefined) };
    return { cabinId: person.cabinSelectionMode === 'CATEGORY_HOLD' ? null : person.cabinId, tourPackageId: person.tourPackageId || undefined,
        cabinSelectionMode: person.cabinSelectionMode, cabinGroupKey: person.cabinGroupKey?.trim() || undefined,
        farePackageOfferId: person.farePackageOfferId, farePackagePriceRevisionId: person.farePackagePriceRevisionId };
}
export function serializeBooking(draft: BookingDraft) {
    return { cruiseId: draft.cruiseId, currency: draft.currency, paymentPlan: draft.paymentPlan, notes: draft.notes.trim() || undefined, passengers: draft.passengers.map(person => ({ fullName: person.fullName.trim(), ...serializeCabinSelection(person), dateOfBirth: person.dateOfBirth || undefined, nationality: person.nationality.trim() || undefined, documentType: person.documentType || undefined, documentNumber: person.documentNumber.trim() || undefined, email: person.email.trim() || undefined, phoneNumber: person.phoneNumber.trim() || undefined })) };
}
export function bookingCruisePackageSelectionErrors(draft: BookingDraft, catalog: CruisePackageCatalog | null | undefined): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!catalog || catalog.cruiseId !== draft.cruiseId) {
        if (draft.cruiseId)
            errors['real-booking-cruise'] = 'Cần đối chiếu danh mục gói vé của đúng chuyến khởi hành.';
        return errors;
    }
    const groups = new Map<string, string>();
    draft.passengers.forEach((person, index) => {
        const fare = catalog.offers.find(o => o.selection.offerId === person.farePackageOfferId)?.selection;
        if (catalog.fareManaged && (!fare || fare.priceRevisionId !== person.farePackagePriceRevisionId))
            errors[`person-${index}-farePackageOfferId`] = 'Chọn gói vé và giá hiện hành của chuyến; không tự dùng giá mới khi lựa chọn cũ đã thay đổi.';
        if (!catalog.fareManaged && (person.farePackageOfferId || person.cabinSelectionMode === 'CATEGORY_HOLD'))
            errors[`person-${index}-farePackageOfferId`] = 'Lựa chọn gói vé không khớp phạm vi bán của chuyến khởi hành.';
        if (person.farePackageOfferId && fare) {
            const key = person.cabinGroupKey?.trim() || (person.cabinSelectionMode === 'CATEGORY_HOLD' ? 'BOOKING_GROUP' : 'CABIN:' + person.cabinId), resource = person.cabinSelectionMode + ':' + (person.cabinSelectionMode === 'CATEGORY_HOLD' ? fare.cabinType : person.cabinId);
            const previous = groups.get(key);
            if (previous && previous !== resource)
                errors[`person-${index}-cabinGroupKey`] = 'Một nhóm phải giữ nguyên trong một hạng/cabin; không tự chia nhóm.';
            groups.set(key, resource);
        }
    });
    return errors;
}
export function bookingPackageErrors(draft: BookingDraft, packages: {
    id: string;
    currency: string;
}[] | null): Record<string, string> {
    const errors: Record<string, string> = {};
    draft.passengers.forEach((person, index) => {
        if (!person.tourPackageId)
            return;
        const pack = packages?.find(item => item.id === person.tourPackageId);
        if (!pack)
            errors[`person-${index}-tourPackageId`] = 'Gói đã chọn chưa tải được hoặc không còn hoạt động. Bỏ chọn hoặc tải lại gói.';
        else if (pack.currency !== draft.currency)
            errors[`person-${index}-tourPackageId`] = `Gói dùng ${pack.currency}, khác tiền tệ đặt chỗ ${draft.currency}. Chọn gói cùng tiền tệ hoặc bỏ chọn gói.`;
    });
    return errors;
}
export function bookingFieldErrors(draft: BookingDraft, cruise: BookingCruiseOption | undefined, cabins: AvailableCabin[] | null, now = Date.now(), step = 3): Record<string, string> {
    const errors: Record<string, string> = {};
    const used = new Map<string, number>(), documents = new Set<string>();
    if (step !== 2) {
        if (!cruise || cruise.cruiseId !== draft.cruiseId || cruise.status !== 'PUBLISHED' || cruise.sellable !== true || !cruise.shipId || !Number.isFinite(Date.parse(cruise.departureDatetime)) || Date.parse(cruise.departureDatetime) <= now)
            errors['real-booking-cruise'] = 'Chọn chuyến khởi hành đang mở bán và còn chỗ theo dữ liệu máy chủ.';
        if (!cabins || !draft.passengers.length)
            errors['real-booking-cruise'] = 'Cần danh sách phòng trống và ít nhất một hành khách.';
        draft.passengers.forEach(person => { if (person.cabinId)
            used.set(person.cabinId, (used.get(person.cabinId) ?? 0) + 1); });
        draft.passengers.forEach((person, index) => {
            const fare = Boolean(person.farePackageOfferId || person.farePackagePriceRevisionId || person.cabinSelectionMode === 'CATEGORY_HOLD');
            if (fare && (!person.farePackageOfferId || !person.farePackagePriceRevisionId))
                errors[`person-${index}-farePackageOfferId`] = 'Chọn đúng gói vé và phiên bản giá cho hành khách.';
            if (fare && !person.cabinSelectionMode)
                errors[`person-${index}-cabinSelectionMode`] = 'Chọn cabin vật lý ngay hoặc giữ chỗ theo hạng.';
            if (fare && person.tourPackageId)
                errors[`person-${index}-tourPackageId`] = 'Cần bỏ lựa chọn gói dịch vụ cũ trước khi dùng gói vé.';
            if (person.cabinSelectionMode === 'CATEGORY_HOLD') {
                if (person.cabinId)
                    errors[`person-${index}-cabinId`] = 'Không đồng thời chọn cabin vật lý và giữ chỗ theo hạng.';
                return;
            }
            const cabin = cabins?.find(item => item.cabinId === person.cabinId);
            if (!cabin)
                errors[`person-${index}-cabinId`] = 'Vui lòng chọn phòng còn trống.';
            else if ((used.get(cabin.cabinId) ?? 0) > cabin.remainingCapacity)
                errors[`person-${index}-cabinId`] = `Phòng ${cabin.cabinNumber} chỉ còn ${cabin.remainingCapacity} chỗ cho nhóm của bạn.`;
            else if (fare && cabin.remainingCapacity !== cabin.capacity)
                errors[`person-${index}-cabinId`] = 'Cabin đã có phân bổ khác; chọn cabin còn nguyên khả năng đáp ứng nhóm.';
        });
    }
    if (step !== 1) {
        if (!/^[A-Z]{3}$/.test(draft.currency))
            errors['real-booking-currency'] = 'Tiền tệ phải là mã 3 chữ cái in hoa.';
        if (!['FULL', 'DEPOSIT', 'STAGES'].includes(draft.paymentPlan))
            errors['real-booking-plan'] = 'Chọn hình thức thanh toán hợp lệ.';
        if (draft.notes.length > 500)
            errors['real-booking-notes'] = 'Ghi chú không được vượt quá 500 ký tự.';
        if (!draft.passengers[0]?.email.trim() && !draft.passengers[0]?.phoneNumber.trim())
            errors['person-0-email'] = 'Người đại diện cần email hoặc số điện thoại liên hệ.';
        draft.passengers.forEach((person, index) => {
            const field = (key: keyof BookingPersonDraft, message: string) => { errors[`person-${index}-${key}`] = message; };
            if (person.fullName.trim().length < 2 || person.fullName.trim().length > 100)
                field('fullName', 'Họ tên cần từ 2 đến 100 ký tự.');
            if (person.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim()))
                field('email', 'Email chưa đúng định dạng.');
            if (person.phoneNumber.trim() && !/^(\+?[0-9]{8,15})$/.test(person.phoneNumber.trim()))
                field('phoneNumber', 'Số điện thoại cần 8–15 chữ số, có thể bắt đầu bằng +.');
            if (person.dateOfBirth) {
                const birth = Date.parse(person.dateOfBirth);
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(person.dateOfBirth) || !Number.isFinite(birth) || new Date(birth).toISOString().slice(0, 10) !== person.dateOfBirth || birth >= today.getTime())
                    field('dateOfBirth', 'Ngày sinh cần là ngày hợp lệ trong quá khứ.');
            }
            if (person.documentType && !person.documentNumber.trim())
                field('documentNumber', 'Nhập số giấy tờ cho loại đã chọn.');
            const number = person.documentNumber.trim().toUpperCase();
            if (number.length > 30)
                field('documentNumber', 'Số giấy tờ tối đa 30 ký tự.');
            if (number && documents.has(number))
                field('documentNumber', 'Số giấy tờ trùng với hành khách khác.');
            if (number)
                documents.add(number);
            if (person.nationality.trim() && (person.nationality.trim().length < 2 || person.nationality.trim().length > 10))
                field('nationality', 'Mã quốc tịch cần từ 2 đến 10 ký tự (VD: VN).');
        });
    }
    return errors;
}
export function validateBooking(draft: BookingDraft, cruise: BookingCruiseOption | undefined, cabins: AvailableCabin[] | null, now = Date.now()): string[] {
    return Object.values(bookingFieldErrors(draft, cruise, cabins, now));
}
export const realBookingApi = {
    async lookup(reference: string, email: string, phoneNumber: string, signal?: AbortSignal) { const data = decodeBookingDetail(await apiRequest<unknown>('/booking/lookup', { query: { reference: reference.trim(), email: email.trim() || undefined, phoneNumber: phoneNumber.trim() || undefined }, signal })); if (data.bookingReference !== reference.trim())
        throw new Error('Mã đặt chỗ trả về không khớp yêu cầu.'); return data; },
    async cabins(cruiseId: string, signal?: AbortSignal, filters?: {
        cabinType?: string;
        deckId?: string;
        minCapacity?: number;
        bookingPassengerId?: string;
    }): Promise<AvailableCabin[]> {
        const data = await apiRequest<AvailableCabin[]>('/booking/available-cabins', { query: { cruiseId, ...filters }, signal });
        if (!Array.isArray(data) || data.some(item => !item || typeof item.cabinId !== 'string' || !item.cabinId || typeof item.cabinNumber !== 'string' || !item.cabinNumber || !Number.isSafeInteger(item.remainingCapacity) || item.remainingCapacity < 0 || !Number.isSafeInteger(item.capacity) || item.capacity < 1 || item.remainingCapacity > item.capacity))
            throw new Error('Thông tin phòng trống chưa đầy đủ.');
        if (data.some(item => ['estimatedPrice', 'priceMultiplier'].some(key => { const value = item[key as 'estimatedPrice' | 'priceMultiplier']; return value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0); }) || (item.deckNumber != null && !Number.isSafeInteger(item.deckNumber)) || (item.isAccessible != null && typeof item.isAccessible !== 'boolean') || ['deckId', 'deckName', 'cabinType'].some(key => { const value = item[key as 'deckId' | 'deckName' | 'cabinType']; return value != null && typeof value !== 'string'; })))
            throw new Error('Thông tin boong hoặc giá tham chiếu phòng không hợp lệ.');
        return data;
    },
    async cruises(signal?: AbortSignal) {
        const items: BookingCruiseOption[] = [];
        for (let page = 0, pages = 1; page < pages; page++) {
            const data = await apiRequest<{
                content: BookingCruiseOption[];
                totalPages: number;
            }>('/cruise', { query: { page, size: 100, status: 'PUBLISHED' }, signal });
            if (!Array.isArray(data?.content) || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 || data.content.some(item => !item || !item.cruiseId || !item.cruiseName || item.status !== 'PUBLISHED' || !Number.isFinite(Date.parse(item.departureDatetime))))
                throw new Error('Không tải được chuyến đã công bố.');
            items.push(...data.content);
            pages = data.totalPages;
        }
        const available = await Promise.all(items.map(async (item) => {
            const state = await apiRequest<{
                cruiseId: string;
                sellable: boolean;
                transactionReady?: boolean;
            }>(`/cruise/${encodeURIComponent(item.cruiseId)}/sellability`, { signal });
            if (state.cruiseId !== item.cruiseId || typeof state.sellable !== 'boolean')
                throw new ApiError('', 502);
            return { ...item, sellable: state.sellable && state.transactionReady !== false };
        }));
        return available.filter(item => item.sellable === true);
    },
    async packages(signal?: AbortSignal) { const data = await apiRequest<{
        id: string;
        name: string;
        status: string;
        price: number;
        currency: string;
    }[]>('/servicepackage/packages', { signal }); if (!Array.isArray(data) || data.some(item => !item || !item.id || !item.name || typeof item.status !== 'string' || typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 || typeof item.currency !== 'string' || !/^[A-Z]{3}$/.test(item.currency)))
        throw new Error('Không tải được gói dịch vụ.'); return data.filter(item => item.status === 'ACTIVE'); },
    async packagesForCruise(cruiseId: string, signal?: AbortSignal) {
        if (!cruiseId)
            return [];
        const links = await apiRequest<unknown>('/cruise/' + encodeURIComponent(cruiseId) + '/packages', { signal });
        if (!Array.isArray(links) || links.some(item => !item || item.cruiseId !== cruiseId || typeof item.tourPackageId !== 'string' || !item.tourPackageId || typeof item.active !== 'boolean'))
            throw new ApiError('Chưa xác định được gói dịch vụ áp dụng cho chuyến khởi hành.', 502);
        const ids = new Set(links.filter(item => item.active).map(item => item.tourPackageId));
        // Assignment + ACTIVE is a prerequisite, not proof that sale/booking is open.
        const catalog = await realBookingApi.packages(signal);
        return catalog.filter(item => ids.has(item.id));
    }
};
