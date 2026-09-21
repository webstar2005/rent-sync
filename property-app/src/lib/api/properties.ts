import { api } from './client';

export type Property = {
  id: number;
  owner_id: number;
  name: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  units: number;
  rent_due_day?: number;
  status: string;
  created_at: string;
};

export type PropertyPaymentSettings = {
  id: number;
  property_id: number;
  mpesa_paybill?: string;
  mpesa_account_number?: string;
  mpesa_till?: string;
  mpesa_account_number_format: 'invoice_number' | 'tenant_name' | 'custom';
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_reference_format: 'invoice_number' | 'tenant_name' | 'custom';
  allowed_methods: Array<'mobile_money' | 'bank_transfer' | 'cash' | 'card' | 'other'>;
  notes?: string;
};

export function getProperties() {
  return api.get<Property[]>('/api/properties');
}

export function createProperty(payload: { name: string; address: string; units?: number; rent_due_day?: number }) {
  return api.post<Property>('/api/properties', payload);
}

export function updateProperty(propertyId: number, payload: { name?: string; address?: string; units?: number; rent_due_day?: number; status?: string }) {
  return api.patch<Property>(`/api/properties/${propertyId}`, payload);
}

export function deleteProperty(propertyId: number) {
  return api.delete(`/api/properties/${propertyId}`);
}

export function getPropertyPaymentSettings(propertyId: number) {
  return api.get<PropertyPaymentSettings | null>(`/api/properties/${propertyId}/payment-settings`);
}

export function savePropertyPaymentSettings(payload: {
  property_id: number;
  mpesa_paybill?: string;
  mpesa_account_number?: string;
  mpesa_till?: string;
  mpesa_account_number_format?: 'invoice_number' | 'tenant_name' | 'custom';
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_reference_format?: 'invoice_number' | 'tenant_name' | 'custom';
  allowed_methods?: Array<'mobile_money' | 'bank_transfer' | 'cash' | 'card' | 'other'>;
  notes?: string;
}) {
  return api.post<PropertyPaymentSettings>(`/api/properties/${payload.property_id}/payment-settings`, payload);
}
