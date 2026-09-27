import { api } from './client';

// Rent Sync's own subscription, as opposed to a tenant's rent. These endpoints are reachable by an
// account that has NOT paid — that is the point of them, they are how a locked-out landlord finds
// out what they owe and hands over their M-Pesa confirmation code.

export type Plan = {
  key: string;
  name: string;
  amount: number | null;
  unitCeiling: number | null;
  unitFloor: number;
  features: string[];
};

// A plan's entitlements, resolved by the server from the tier list. Every gated section and button
// in the dashboard keys off this, so that what a landlord can see and what the API will let them do
// are read from the same place. A plan is not a level number, and it is not safe to compare those
// in the client — the server owns the ordering.
export type Feature =
  | 'collectionRate'
  | 'csvExport'
  | 'maintenance'
  | 'tenantStatements'
  | 'reconciliation'
  | 'bulkImport';

export type Entitlement = {
  features: Feature[];
  unitsUsed: number;
  // The plan's ceiling. Use this rather than subscription.unitsLimit, which is a denormalised copy
  // on the user row and can lag a plan change. null means the plan is uncapped.
  unitsLimit: number | null;
  properties: number;
  atUnitLimit: boolean;
};

export type Subscription = {
  status: 'unpaid' | 'active' | 'suspended';
  plan: string | null;
  planName: string | null;
  amount: number | null;
  unitsLimit: number | null;
  activatedAt: string | null;
  confirmedAt: string | null;
  reference: string | null;
};

export type PendingRequest = {
  id: number;
  plan: string;
  amount: number;
  mpesa_confirmation_code: string;
  created_at: string;
};

export type BillingInfo = {
  method: string;
  phoneDisplay: string;
  phoneE164: string;
  currency: string;
  instructions: string[];
};

export type BillingState = {
  subscription: Subscription;
  entitlement: Entitlement;
  plans: Plan[];
  pendingRequests: PendingRequest[];
  billing: BillingInfo;
};

export function getBilling(): Promise<BillingState> {
  return api.get<BillingState>('/api/billing/me');
}

export function submitPaymentRequest(payload: { plan: string; mpesa_confirmation_code: string }) {
  return api.post<{ message: string; request: PendingRequest }>('/api/billing/request', payload);
}
