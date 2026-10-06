import { api } from './client';

export type Unit = {
  id: number;
  property_id: number;
  unit_number: string;
  unit_type?: 'bedsitter' | '1_bedroom' | '2_bedroom' | '3_bedroom' | 'commercial' | 'other';
  floor?: number;
  size_sqm?: number;
  monthly_rent: number;
  status: 'vacant' | 'occupied' | 'maintenance' | 'reserved';
  tenant_id?: number;
  description?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  tenant_name?: string;
  tenant_phone?: string;
  tenant_email?: string;
  tenant_status?: string;
  tenant_monthly_rent?: number;
  lease_start?: string | null;
  lease_end?: string | null;
  property_name?: string;
  property_owner_id?: number;
  landlord_name?: string;
  landlord_email?: string;
  payment_history?: Array<{
    id: number;
    amount: number;
    payment_method: string;
    reference?: string;
    transaction_ref?: string;
    phone_number?: string;
    paid_at: string;
    status: string;
    matched: boolean;
    invoice_number?: string;
    due_date?: string;
    invoice_amount?: number;
    // Joined off the payment's tenant and channel, so the modal can name who paid without a
    // second request per row.
    tenant_name?: string;
    channel_short_code?: string;
  }>;
};

export type UnitsResponse = {
  units: Unit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function getUnits(propertyId: number, params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.sort) searchParams.set('sort', params.sort);
  if (params?.order) searchParams.set('order', params.order);

  const query = searchParams.toString();
  return api.get<UnitsResponse>(`/api/units/property/${propertyId}${query ? `?${query}` : ''}`);
}

export function getUnit(unitId: number) {
  return api.get<Unit>(`/api/units/${unitId}`);
}

export function createUnit(propertyId: number, payload: {
  unit_number: string;
  unit_type?: 'bedsitter' | '1_bedroom' | '2_bedroom' | '3_bedroom' | 'commercial' | 'other';
  floor?: number;
  size_sqm?: number;
  monthly_rent?: number;
  status?: 'vacant' | 'occupied' | 'maintenance' | 'reserved';
  tenant_id?: number | null;
  description?: string;
}) {
  return api.post<Unit>(`/api/units/property/${propertyId}`, payload);
}

export function updateUnit(unitId: number, payload: {
  unit_number?: string;
  unit_type?: 'bedsitter' | '1_bedroom' | '2_bedroom' | '3_bedroom' | 'commercial' | 'other';
  floor?: number;
  size_sqm?: number;
  monthly_rent?: number;
  status?: 'vacant' | 'occupied' | 'maintenance' | 'reserved';
  tenant_id?: number | null;
  description?: string;
}) {
  return api.patch<Unit>(`/api/units/${unitId}`, payload);
}

export function deleteUnit(unitId: number) {
  return api.delete(`/api/units/${unitId}`);
}

export function assignPropertyLandlord(propertyId: number, landlordId: number) {
  return api.patch<{ id: number; owner_id: number }>(`/api/units/property/${propertyId}/landlord`, { landlord_id: landlordId });
}

export function getAdminProperties() {
  return api.get<Array<{
    id: number;
    owner_id: number;
    name: string;
    address: string;
    city?: string;
    state?: string;
    country?: string;
    units: number;
    rent_due_day: number;
    status: string;
    created_at: string;
    updated_at: string;
    landlord_name?: string;
    landlord_email?: string;
  }>>('/api/units/admin/properties');
}