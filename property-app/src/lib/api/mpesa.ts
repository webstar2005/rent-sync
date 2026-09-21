import { api } from './client';

export function initiateStkPush(payload: { property_id: number; tenant_id: number; phone: string; amount: number; accountReference?: string }) {
  return api.post('/api/mpesa/stk-push', payload);
}
