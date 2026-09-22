import { api, downloadCsv } from './client';

export type ArrearsRow = {
  property_id: number;
  property_name: string;
  total_invoices: number;
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  overdue_count: number;
  pending_count: number;
};

export type CollectionRateRow = {
  month: string;
  invoiced: number;
  collected: number;
  collection_rate_pct: number;
};

export type StatementEntry = {
  type: 'invoice' | 'payment';
  ref_number: string;
  occurred_at: string;
  amount: number;
  running_balance: number;
};

export type TenantStatement = {
  tenant: {
    id: number;
    name: string;
    unit_number: string;
    monthly_rent: number;
    property_id: number;
    property_name: string;
  };
  statement: StatementEntry[];
};

export function getArrears(propertyId?: number) {
  const query = propertyId ? `?property_id=${propertyId}` : '';
  return api.get<ArrearsRow[]>(`/api/reports/arrears${query}`);
}

export function getCollectionRate(months = 12) {
  return api.get<CollectionRateRow[]>(`/api/reports/collection-rate?months=${months}`);
}

export function getTenantStatement(tenantId: number) {
  return api.get<TenantStatement>(`/api/reports/tenant-statement/${tenantId}`);
}

export function downloadArrearsCsv(propertyId?: number) {
  const query = propertyId ? `&property_id=${propertyId}` : '';
  return downloadCsv(`/api/reports/arrears?format=csv${query}`, 'arrears.csv');
}

export function downloadCollectionRateCsv(months = 12) {
  return downloadCsv(`/api/reports/collection-rate?format=csv&months=${months}`, 'collection-rate.csv');
}

export function downloadTenantStatementCsv(tenantId: number, filename: string) {
  return downloadCsv(`/api/reports/tenant-statement/${tenantId}?format=csv`, `statement-${filename}.csv`);
}