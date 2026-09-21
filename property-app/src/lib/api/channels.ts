import { api } from './client';

export type ChannelType = 'paybill' | 'till' | 'bank';
export type VerificationStatus = 'pending' | 'verified' | 'active' | 'inactive' | 'failed';

export type PaymentChannel = {
  id: number;
  owner_id: number;
  channel_type: ChannelType;
  short_code: string;
  account_number?: string;
  payhero_channel_id?: string;
  description?: string;
  is_active: boolean;
  verification_status: VerificationStatus;
  payhero_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type WalletBalance = {
  currency: string;
  available_balance: number;
  low: boolean;
  threshold: number;
};

export function getPaymentChannels() {
  return api.get<PaymentChannel[]>('/api/payment-channels');
}

export function createPaymentChannel(payload: {
  channel_type: ChannelType;
  short_code: string;
  account_number?: string;
  description?: string;
}) {
  return api.post<PaymentChannel>('/api/payment-channels', payload);
}

export function updatePaymentChannel(channelId: number, payload: { description?: string; is_active?: boolean }) {
  return api.patch<PaymentChannel>(`/api/payment-channels/${channelId}`, payload);
}

export function syncPaymentChannel(channelId: number) {
  return api.post<PaymentChannel>(`/api/payment-channels/${channelId}/sync`, {});
}

export function getPayHeroWalletBalance() {
  return api.get<WalletBalance>('/api/payment-channels/wallet');
}