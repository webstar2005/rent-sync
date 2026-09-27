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
