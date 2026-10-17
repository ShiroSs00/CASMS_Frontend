import { apiRequest } from '@/shared/api/client'
import type { SupplierListItem, SupplierStatus, SupplierVerification } from '../model/supplier-list'

export type SupplierDto = {
  supplierId: string
  supplierName: string
  supplierType: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  status: SupplierStatus
  verificationStatus: SupplierVerification
  verifiedAt: string | null
  verifiedBy: string | null
  verificationNotes: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type SupplierRequest = {
  supplierName: string
  supplierType?: string | null
  contactName: string
  contactPhone?: string | null
  contactEmail?: string | null
  notes?: string | null
}

export type SupplierVerificationRequest = {
  verificationStatus: SupplierVerification
  verificationNotes?: string | null
}

export function mapSupplier(dto: SupplierDto): SupplierListItem {
  return {
    id: dto.supplierId,
    supplierName: dto.supplierName,
    supplierType: dto.supplierType ?? 'Chưa phân loại',
    contactName: dto.contactName ?? null,
    contactEmail: dto.contactEmail ?? null,
    contactPhone: dto.contactPhone ?? null,
    status: dto.status,
    verificationStatus: dto.verificationStatus,
    updatedAt: dto.updatedAt,
    notes: dto.notes ?? null,
    createdAt: dto.createdAt ?? null,
    verifiedAt: dto.verifiedAt ?? null,
    verifiedBy: dto.verifiedBy ?? null,
    verificationNotes: dto.verificationNotes ?? null,
  }
}

export const supplierApi = {
  async list(): Promise<SupplierListItem[]> {
    const data = await apiRequest<SupplierDto[]>('/suppliers')
    return data.map(mapSupplier)
  },

  async get(id: string): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>(`/suppliers/${id}`)
    return mapSupplier(data)
  },

  async create(request: SupplierRequest): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>('/suppliers', {
      method: 'POST',
      body: request,
    })
    return mapSupplier(data)
  },

  async update(id: string, request: SupplierRequest): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>(`/suppliers/${id}`, {
      method: 'PUT',
      body: request,
    })
    return mapSupplier(data)
  },

  async deleteUnused(id: string): Promise<void> {
    await apiRequest<void>(`/suppliers/${id}`, {
      method: 'DELETE',
    })
  },

  async activate(id: string): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>(`/suppliers/${id}/activate`, {
      method: 'PATCH',
    })
    return mapSupplier(data)
  },

  async deactivate(id: string): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>(`/suppliers/${id}/deactivate`, {
      method: 'PATCH',
    })
    return mapSupplier(data)
  },

  async verify(id: string, request: SupplierVerificationRequest): Promise<SupplierListItem> {
    const data = await apiRequest<SupplierDto>(`/suppliers/${id}/verification`, {
      method: 'POST',
      body: request,
    })
    return mapSupplier(data)
  },

  async validate(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/suppliers/${id}/validate`, {
      method: 'POST',
    })
  },
}
