import { api } from './client';

export type MaintenanceRequest = {
  id: number;
  property_id: number;
  tenant_id?: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  property_name?: string;
  tenant_name?: string;
  created_at: string;
};

export function getMaintenanceRequests() {
  return api.get<MaintenanceRequest[]>('/api/maintenance');
}

export function createMaintenanceRequest(payload: {
  property_id: number;
  tenant_id?: number;
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
}) {
  return api.post<MaintenanceRequest>('/api/maintenance', payload);
}

export function updateMaintenanceRequest(id: number, payload: Partial<{ title: string; description: string; priority: string; status: string; tenant_id: number | null }>) {
  return api.patch<MaintenanceRequest>(`/api/maintenance/${id}`, payload);
}

export function deleteMaintenanceRequest(id: number) {
  return api.delete(`/api/maintenance/${id}`);
}
