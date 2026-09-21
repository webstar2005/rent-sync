import { api } from './client';

export type Payment = {
  id: number;
  invoice_id: number;
  tenant_id: number;
  amount: number;
  payment_method: string;
  reference?: string;
  paid_at: string;
  status: string;
  invoice_number?: string;
  tenant_name?: string;
};

export function getPayments() {
  return api.get<Payment[]>('/api/payments');
}

export function createPayment(payload: {
  invoice_id: number;
  tenant_id: number;
  amount: number;
  payment_method: 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other';
  reference?: string;
  status?: 'pending' | 'completed' | 'failed' | 'refunded';
}) {
  return api.post<Payment>('/api/payments', payload);
}
