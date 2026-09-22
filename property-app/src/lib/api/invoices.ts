import { api } from './client';

export type Invoice = {
  id: number;
  tenant_id: number;
  property_id: number;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  notes?: string;
  tenant_name?: string;
  property_name?: string;
};

export type InvoiceGenerationResult = {
  generated: number;
  skipped: number;
  period: string;
  overdue_marked: number;
};

export function getInvoices() {
  return api.get<Invoice[]>('/api/invoices');
}

export function createInvoice(payload: {
  tenant_id: number;
  property_id: number;
  invoice_number: string;
  amount: number;
  due_date: string;
  notes?: string;
}) {
  return api.post<Invoice>('/api/invoices', payload);
}

// Auto-generate next month's rent invoices for this landlord (idempotent) and flip overdue.
export function generateInvoices(month?: string) {
  return api.post<InvoiceGenerationResult>('/api/invoices/generate', month ? { month } : {});
}
