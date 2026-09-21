import { api } from './client';

export type ReconciliationAlert = {
  id: number;
  match_status: string;
  transaction_ref?: string;
  payment_method: string;
  created_at: string;
  invoice_number?: string;
  invoice_amount?: number;
  tenant_name?: string;
  property_name?: string;
};

export type ReconciliationSummary = {
  unmatched_count: number;
  duplicate_count: number;
  manual_review_count: number;
  matched_count: number;
};

export function getReconciliationAlerts() {
  return api.get<ReconciliationAlert[]>('/api/reconciliation/alerts');
}

export function getReconciliationSummary() {
  return api.get<ReconciliationSummary>('/api/reconciliation/summary');
}

export function reconcilePayment(payload: {
  property_id: number;
  tenant_name: string;
  amount: number;
  payment_method: 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other';
  reference?: string;
  transaction_ref?: string;
  invoice_id?: number;
  raw_payload?: Record<string, unknown>;
}) {
  return api.post<{ payment: unknown; invoiceStatus: string; tenant: unknown; invoice: unknown; match_status: string }>(
    '/api/reconciliation/reconcile',
    payload
  );
}
