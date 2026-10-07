import { createContext, useContext } from 'react';
import type { FormEvent } from 'react';
import type { AuthUser } from '../lib/api/auth';
import type { Entitlement, Feature } from '../lib/api/billing';
import type { Property } from '../lib/api/properties';
import type { Tenant } from '../lib/api/tenants';
import type { Invoice } from '../lib/api/invoices';
import type { Payment } from '../lib/api/payments';
import type { MaintenanceRequest } from '../lib/api/maintenance';
import type { PaymentChannel } from '../lib/api/channels';
import type { ReconciliationAlert } from '../lib/api/reconciliation';
import type { ArrearsRow, CollectionRateRow, TenantStatement } from '../lib/api/reports';

export type PageId =
  | 'overview'
  | 'properties'
  | 'tenants'
  | 'invoices'
  | 'payments'
  | 'channels'
  | 'reports'
  | 'maintenance';

export type ModalId =
  | 'add-property'
  | 'add-tenant'
  | 'import-tenants'
  | 'add-channel'
  | 'new-maintenance';

export type PropertyForm = { name: string; address: string; units: string; rent_due_day: string };
export type EditPropertyForm = PropertyForm & { status: string };
export type TenantForm = {
  property_id: string;
  name: string;
  phone: string;
  unit_number: string;
  monthly_rent: string;
  status: string;
};
export type MaintenanceForm = {
  property_id: string;
  tenant_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
};
export type PaymentChannelForm = {
  channel_type: 'paybill' | 'till' | 'bank';
  short_code: string;
  account_number: string;
  description: string;
};
export type ManualPaymentForm = {
  property_id: string;
  tenant_name: string;
  amount: string;
  payment_method: 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other';
  reference: string;
  transaction_ref: string;
};
export type PaymentMethod = 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other';

export type RentStatus = { status: string; amountDue: number; label: string };

export type PropertySummary = {
  property: Property;
  totalUnits: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
};

export type PropertyPaymentStatus = {
  property: Property;
  paidTenants: Tenant[];
  unpaidTenants: Tenant[];
  paymentChannels: string[];
};

export type AttentionItem = Omit<Tenant, 'status'> & {
  propertyName: string;
  status: string;
  label: string;
  amountDue: number;
};

export type ReconciliationSummary = {
  unmatched_count: number;
  duplicate_count: number;
  manual_review_count: number;
  matched_count: number;
};

/* Everything the dashboard pages are allowed to see.

   App.tsx keeps every piece of state, every handler and every derived value
   exactly where it was - this interface is the window onto them, so moving a
   section into a page is a presentation change and nothing else. */
export interface DashboardValue {
  user: AuthUser | null;
  subscriptionStatus: string | null;
  entitlement: Entitlement | null | undefined;

  properties: Property[];
  tenants: Tenant[];
  invoices: Invoice[];
  payments: Payment[];
  maintenance: MaintenanceRequest[];
  paymentChannels: PaymentChannel[];
  reconciliationAlerts: ReconciliationAlert[];
  reconciliationSummary: ReconciliationSummary;
  arrears: ArrearsRow[];
  collectionRate: CollectionRateRow[];
  tenantStatement: TenantStatement | null;
  setTenantStatement: (value: TenantStatement | null) => void;

  loading: boolean;
  dataLoading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  error: string;
  invoiceNotice: string;
  generatingInvoices: boolean;
  reportsLoading: boolean;
  reportsError: string;

  // Record-a-payment-by-hand flow (lives inside the tenant detail sheet).
  recordPaymentNotice: string;
  recordError: string;
  savingPayment: boolean;
  recordingInvoiceId: number | null;
  recordAmount: string;
  recordMethod: PaymentMethod;
  recordReference: string;
  setRecordAmount: (value: string) => void;
  setRecordMethod: (value: PaymentMethod) => void;
  setRecordReference: (value: string) => void;

  // Forms and their field-level errors.
  propertyForm: PropertyForm;
  setPropertyForm: (value: PropertyForm) => void;
  editPropertyForm: EditPropertyForm;
  setEditPropertyForm: (value: EditPropertyForm) => void;
  propertyErrors: Record<string, string>;
  setPropertyErrors: (value: Record<string, string>) => void;
  tenantForm: TenantForm;
  setTenantForm: (value: TenantForm) => void;
  maintenanceForm: MaintenanceForm;
  setMaintenanceForm: (value: MaintenanceForm) => void;
  paymentChannelForm: PaymentChannelForm;
  setPaymentChannelForm: (value: PaymentChannelForm) => void;
  manualPaymentForm: ManualPaymentForm;
  setManualPaymentForm: (value: ManualPaymentForm) => void;
  paymentChannelError: string;
  paymentChannelLoading: boolean;

  // Filters and local view state.
  attentionFilter: 'all' | 'overdue' | 'partial' | 'paid';
  setAttentionFilter: (value: 'all' | 'overdue' | 'partial' | 'paid') => void;
  attentionSearch: string;
  setAttentionSearch: (value: string) => void;
  attentionPropertyFilter: 'all' | number;
  setAttentionPropertyFilter: (value: 'all' | number) => void;
  tenantRosterSearch: string;
  setTenantRosterSearch: (value: string) => void;
  reportPropertyFilter: 'all' | number;
  setReportPropertyFilter: (value: 'all' | number) => void;
  reportStatementTenantId: number | '';
  setReportStatementTenantId: (value: number | '') => void;

  selectedPropertyForUnits: number | null;
  setSelectedPropertyForUnits: (value: number | null) => void;
  selectedTenantId: number | null;
  setSelectedTenantId: (value: number | null) => void;
  editingPropertyId: number | null;
  setEditingPropertyId: (value: number | null) => void;
  deletingPropertyId: number | null;

  // Derived values, computed in App exactly as before.
  activeTenants: Tenant[];
  tenantRoster: Tenant[];
  maintenanceActionQueue: MaintenanceRequest[];
  escalatedUrgent: MaintenanceRequest[];
  totalCollected: number;
  totalOutstanding: number;
  recentInvoices: Invoice[];
  unmatchedPaymentCount: number;
  propertySummaries: PropertySummary[];
  propertyPaymentStatus: PropertyPaymentStatus[];
  attentionItems: AttentionItem[];
  selectedTenant: Tenant | null;
  selectedTenantInvoices: Invoice[];
  selectedTenantPayments: Payment[];
  selectedTenantSummary: RentStatus | null;

  // Navigation and modal plumbing.
  page: PageId;
  goTo: (page: PageId) => void;
  modal: ModalId | null;
  openModal: (modal: ModalId) => void;
  closeModal: () => void;

  can: (feature: Feature) => boolean;
  loadProperties: (silent?: boolean, known?: Entitlement | null) => Promise<void>;
  startCollecting: () => void;
  handleRefresh: () => Promise<void>;
  handleLogout: () => void;
  handleSetupAction: (step: 'property' | 'tenant' | 'invoice' | 'collect' | 'channel') => void;
  handleGenerateInvoices: () => Promise<void>;
  handleTenantsImported: (imported?: Tenant[]) => Promise<void>;

  validatePropertyForm: (data: PropertyForm) => Record<string, string>;
  handlePropertySubmit: (event: FormEvent) => Promise<void> | void;
  handlePropertyUpdate: (event: FormEvent) => Promise<void> | void;
  handlePropertyEditStart: (property: Property) => void;
  handlePropertyDelete: (propertyId: number) => Promise<void>;
  handleTenantSubmit: (event: FormEvent) => Promise<void> | void;
  handleTenantLifecycleAction: (
    tenantId: number,
    action: 'moved_out' | 'archived' | 'delete'
  ) => Promise<void>;
  handleMaintenanceSubmit: (event: FormEvent) => Promise<void> | void;
  handleMaintenanceStatusChange: (id: number, status: string) => Promise<void>;
  handleMaintenanceEscalate: (id: number) => Promise<void>;
  handleMaintenanceDelete: (id: number) => Promise<void>;
  handleManualPaymentReconciliation: (event: FormEvent) => Promise<void> | void;
  handlePaymentChannelSubmit: (event: FormEvent) => Promise<void> | void;
  handlePaymentChannelToggle: (channel: PaymentChannel) => Promise<void>;
  handlePaymentChannelSync: (channelId: number) => Promise<void>;
  handlePaymentChannelDelete: (channel: PaymentChannel) => Promise<void>;
  loadPaymentChannels: () => Promise<unknown>;
  loadReports: () => Promise<void>;
  handleTenantStatementLoad: () => Promise<void>;

  openRecordPayment: (invoice: Invoice, tenantId: number, outstanding: number) => void;
  closeRecordPayment: () => void;
  handleSaveRecordedPayment: (event: FormEvent, invoice: Invoice) => Promise<void>;

  downloadArrearsCsv: (propertyId?: number) => unknown;
  downloadCollectionRateCsv: () => unknown;
  downloadTenantStatementCsv: (tenantId: number, filename: string) => unknown;
}

export const DashboardContext = createContext<DashboardValue | null>(null);

const PAGE_IDS: readonly string[] = [
  'overview',
  'properties',
  'tenants',
  'invoices',
  'payments',
  'channels',
  'reports',
  'maintenance',
];

/** Reads `#/properties` (and tolerates a bare `properties` or no hash at all). */
export function readPageFromHash(): PageId {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return (PAGE_IDS.includes(raw) ? raw : 'overview') as PageId;
}

export function useDashboard(): DashboardValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used within DashboardProvider');
  return value;
}
