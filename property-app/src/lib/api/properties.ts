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
