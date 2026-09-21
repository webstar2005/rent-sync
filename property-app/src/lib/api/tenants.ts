import { api } from './client';

export type Tenant = {
  id: number;
  property_id: number;
  property_name?: string;
  name: string;
  email?: string;
  phone?: string;
  unit_number: string;
  monthly_rent: number;
  status: 'active' | 'pending' | 'moved_out' | 'archived';
  created_at: string;
};

export function getTenants() {
  return api.get<Tenant[]>('/api/tenants');
}

export function createTenant(payload: {
  property_id: number;
  name: string;
  phone?: string;
  unit_number: string;
  monthly_rent: number;
  status?: 'active' | 'pending' | 'moved_out' | 'archived';
}) {
  return api.post<Tenant>('/api/tenants', payload);
}

export function bulkImportTenants(payload: {
  tenants: Array<{
    property_name: string;
    unit_number: string;
    tenant_name: string;
    phone?: string;
    rent_amount: string | number;
    lease_start?: string | null;
    lease_end?: string | null;
  }>;
}) {
  return api.post<{
    imported: number;
    skipped: number;
    total: number;
    tenants: Tenant[];
    skippedRows: Array<{ row: number; propertyName: string; unitNumber: string; tenantName: string; reason: string }>;
  }>('/api/tenants/bulk', payload);
}

export function updateTenantStatus(tenantId: number, status: 'active' | 'pending' | 'moved_out' | 'archived') {
  return api.patch<Tenant>(`/api/tenants/${tenantId}/status`, { status });
}

export function deleteTenant(tenantId: number) {
  return api.delete(`/api/tenants/${tenantId}`);
}
