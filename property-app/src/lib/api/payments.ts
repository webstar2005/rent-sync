import { api } from './client';

export type Payment = {
  id: number;
  // Nullable: a payment the webhook could not attribute to an invoice is still recorded and still
  // listed. The dashboard must show it — an unmatched payment is exactly what a landlord needs to see.
  invoice_id: number | null;
  tenant_id: number | null;
  amount: number;
  payment_method: string;
  reference?: string;
  paid_at: string;
  status: string;
  matched?: boolean;
  phone_number?: string;
  transaction_ref?: string;
  invoice_number?: string | null;
  tenant_name?: string | null;
  channel_short_code?: string | null;
  channel_type?: string | null;
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
