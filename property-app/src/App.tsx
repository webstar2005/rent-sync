import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { googleLogin, login, logout, register, type AuthUser } from './lib/api/auth';
import { getApiHealth } from './lib/api/client';
import { createProperty, getProperties, getPropertyPaymentSettings, savePropertyPaymentSettings, updateProperty, deleteProperty, type Property, type PropertyPaymentSettings } from './lib/api/properties';
import { createTenant, deleteTenant, getTenants, updateTenantStatus, type Tenant } from './lib/api/tenants';
import { getInvoices, type Invoice } from './lib/api/invoices';
import { getPayments, type Payment } from './lib/api/payments';
import { createMaintenanceRequest, getMaintenanceRequests, updateMaintenanceRequest, deleteMaintenanceRequest, type MaintenanceRequest } from './lib/api/maintenance';
import { initiateStkPush } from './lib/api/mpesa';
import { getPayHeroWalletBalance, createPaymentChannel, getPaymentChannels, syncPaymentChannel, updatePaymentChannel, type PaymentChannel, type WalletBalance } from './lib/api/channels';
import { getReconciliationAlerts, getReconciliationSummary, reconcilePayment, type ReconciliationAlert } from './lib/api/reconciliation';
import { BulkTenantImport } from './components/BulkTenantImport';

type Mode = 'login' | 'register';
type PaymentReferenceFormat = 'invoice_number' | 'tenant_name' | 'custom';
type PaymentMethod = 'mobile_money' | 'bank_transfer' | 'cash' | 'card' | 'other';

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPaymentForm, setManualPaymentForm] = useState({
    property_id: '',
    tenant_name: '',
    amount: '0',
    payment_method: 'mobile_money' as 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other',
    reference: '',
    transaction_ref: '',
  });
  const [authForm, setAuthForm] = useState({
    name: '',
    email: 'admin@example.com',
    password: 'password123',
    role: 'landlord',
  });
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    address: '',
    units: '1',
    rent_due_day: '5',
  });
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const [editPropertyForm, setEditPropertyForm] = useState({ name: '', address: '', units: '1', rent_due_day: '5', status: 'active' });
  const [propertyErrors, setPropertyErrors] = useState<Record<string, string>>({});
  const [tenantForm, setTenantForm] = useState({
    property_id: '',
    name: '',
    phone: '',
    unit_number: '',
    monthly_rent: '0',
    status: 'active',
  });
  const [maintenanceForm, setMaintenanceForm] = useState({
    property_id: '',
    tenant_id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
  });
  const [attentionFilter, setAttentionFilter] = useState<'all' | 'overdue' | 'partial' | 'paid'>('all');
  const [attentionSearch, setAttentionSearch] = useState('');
  const [attentionPropertyFilter, setAttentionPropertyFilter] = useState<'all' | number>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [reconciliationAlerts, setReconciliationAlerts] = useState<ReconciliationAlert[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState({ unmatched_count: 0, duplicate_count: 0, manual_review_count: 0, matched_count: 0 });
  const [paymentSettings, setPaymentSettings] = useState<Record<number, PropertyPaymentSettings | null>>({});
  const [paymentSettingsForm, setPaymentSettingsForm] = useState<{
    property_id: string;
    mpesa_paybill: string;
    mpesa_account_number: string;
    mpesa_till: string;
    mpesa_account_number_format: PaymentReferenceFormat;
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_reference_format: PaymentReferenceFormat;
    allowed_methods: PaymentMethod[];
    notes: string;
  }>({
    property_id: '',
    mpesa_paybill: '',
    mpesa_account_number: '',
    mpesa_till: '',
    mpesa_account_number_format: 'tenant_name',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_reference_format: 'tenant_name',
    allowed_methods: ['mobile_money', 'bank_transfer'],
    notes: '',
  });
  const [stkForm, setStkForm] = useState({ property_id: '', tenant_id: '', phone: '', amount: '' });
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelForm, setPaymentChannelForm] = useState({ channel_type: 'paybill' as 'paybill' | 'till' | 'bank', short_code: '', account_number: '', description: '' });
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [paymentChannelError, setPaymentChannelError] = useState('');
  const [paymentChannelLoading, setPaymentChannelLoading] = useState(false);

  const isLoggedIn = Boolean(localStorage.getItem('property_app_token'));

  async function handleGoogleCredentialResponse(response: { credential?: string }) {
    if (!response.credential) {
      setError('Google sign-in was cancelled.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await googleLogin(response.credential);
      setUser(result.user);
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const scriptId = 'google-gsi';
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'login' || !window.google?.accounts?.id || !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      return;
    }

    const container = document.getElementById('google-signin-button');
    if (!container) {
      return;
    }

    const googleId = window.google.accounts.id;
    googleId.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse,
    });

    googleId.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
    });
  }, [mode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('property_app_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    if (isLoggedIn) {
      loadProperties();
      loadPaymentChannels();
    }
  }, [isLoggedIn]);

  async function loadProperties() {
    try {
      const [propRes, tenantRes, invoiceRes, paymentRes, maintRes, alertsRes, summaryRes] = await Promise.allSettled([
        getProperties(),
        getTenants(),
        getInvoices(),
        getPayments(),
        getMaintenanceRequests(),
        getReconciliationAlerts(),
        getReconciliationSummary(),
      ]);

      if (propRes.status === 'rejected') throw propRes.reason;

      const nextProperties = propRes.status === 'fulfilled' ? propRes.value : [];
      const nextTenants = tenantRes.status === 'fulfilled' ? tenantRes.value : [];
      const nextInvoices = invoiceRes.status === 'fulfilled' ? invoiceRes.value : [];
      const nextPayments = paymentRes.status === 'fulfilled' ? paymentRes.value : [];
      const nextMaintenance = maintRes.status === 'fulfilled' ? maintRes.value : [];
      const nextAlerts = alertsRes.status === 'fulfilled' ? alertsRes.value : [];
      const nextSummary = summaryRes.status === 'fulfilled' ? summaryRes.value : { unmatched_count: 0, duplicate_count: 0, manual_review_count: 0, matched_count: 0 };

      if (tenantRes.status === 'rejected') console.warn('tenants failed', tenantRes.reason);
      if (invoiceRes.status === 'rejected') console.warn('invoices failed', invoiceRes.reason);
      if (paymentRes.status === 'rejected') console.warn('payments failed', paymentRes.reason);
      if (maintRes.status === 'rejected') console.warn('maintenance failed', maintRes.reason);
      if (alertsRes.status === 'rejected') console.warn('reconciliation alerts failed', alertsRes.reason);
      if (summaryRes.status === 'rejected') console.warn('reconciliation summary failed', summaryRes.reason);

      setProperties(nextProperties);
      setTenants(nextTenants);
      setInvoices(nextInvoices);
      setPayments(nextPayments);
      setMaintenance(nextMaintenance);
      setReconciliationAlerts(nextAlerts);
      setReconciliationSummary(nextSummary);

      for (const property of nextProperties) {
        await loadPaymentSettingsForProperty(property.id);
      }
    } catch (err) {
      console.error(err);

      try {
        const health = await getApiHealth();
        if (!health.ok) {
          setError('The dashboard cannot reach the backend API. Please start the backend on localhost:4000 and refresh the page. (DATABASE_URL must be set, see backend/.env)');
          return;
        }
      } catch {
        // fall through
      }

      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Backend not reachable at http://localhost:4000 — is `npm run dev` running in property-app/backend and is DATABASE_URL set?');
        return;
      }
      setError(`Unable to load dashboard data: ${msg}. Please refresh or check backend logs (backend npm run dev).`);
    }
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const result = await login(authForm.email, authForm.password);
        setUser(result.user);
      } else {
        const result = await register({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          role: authForm.role,
        });
        setUser(result.user);
      }

      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  function validatePropertyForm(data: { name: string; address: string; units: string; rent_due_day: string }) {
    const e: Record<string, string> = {};
    if (!data.name.trim() || data.name.trim().length < 2) e.name = 'Property name must be at least 2 characters';
    if (!data.address.trim() || data.address.trim().length < 5) e.address = 'Address must be at least 5 characters';
    const units = Number(data.units);
    if (!data.units || Number.isNaN(units) || units < 1 || !Number.isInteger(units)) e.units = 'Units must be an integer ≥ 1';
    const due = Number(data.rent_due_day);
    if (!data.rent_due_day || Number.isNaN(due) || due < 1 || due > 28) e.rent_due_day = 'Due day must be 1–28';
    return e;
  }

  async function handlePropertySubmit(event: FormEvent) {
    event.preventDefault();
    const errs = validatePropertyForm(propertyForm);
    setPropertyErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setError('');

    try {
      await createProperty({
        name: propertyForm.name.trim(),
        address: propertyForm.address.trim(),
        units: Number(propertyForm.units),
        rent_due_day: Number(propertyForm.rent_due_day),
      } as any);

      setPropertyForm({ name: '', address: '', units: '1', rent_due_day: '5' });
      setPropertyErrors({});
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Property creation failed');
    } finally {
      setLoading(false);
    }
  }

  function handlePropertyEditStart(property: any) {
    setEditingPropertyId(property.id);
    setEditPropertyForm({
      name: property.name,
      address: property.address,
      units: String(property.units ?? 1),
      rent_due_day: String(property.rent_due_day ?? 5),
      status: property.status ?? 'active',
    });
    setPropertyErrors({});
  }

  async function handlePropertyUpdate(event: FormEvent) {
    event.preventDefault();
    if (editingPropertyId == null) return;
    const errs = validatePropertyForm(editPropertyForm);
    setPropertyErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setError('');
    try {
      await updateProperty(editingPropertyId, {
        name: editPropertyForm.name.trim(),
        address: editPropertyForm.address.trim(),
        units: Number(editPropertyForm.units),
        rent_due_day: Number(editPropertyForm.rent_due_day),
        status: editPropertyForm.status as any,
      });
      setEditingPropertyId(null);
      setPropertyErrors({});
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Property update failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePropertyDelete(propertyId: number) {
    if (!confirm('Delete this property? All tenants, invoices, payments, and maintenance for this property will be deleted (cascade). This cannot be undone.')) return;
    setLoading(true);
    setError('');
    try {
      await deleteProperty(propertyId);
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Property delete failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadPaymentSettingsForProperty(propertyId: number) {
    try {
      const settings = await getPropertyPaymentSettings(propertyId);
      setPaymentSettings((current) => ({ ...current, [propertyId]: settings }));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadPaymentChannels() {
    try {
      const [channelsRes, walletRes] = await Promise.allSettled([getPaymentChannels(), getPayHeroWalletBalance()]);
      if (channelsRes.status === 'fulfilled') setPaymentChannels(channelsRes.value);
      if (channelsRes.status === 'rejected') console.warn('payment channels failed', channelsRes.reason);
      if (walletRes.status === 'fulfilled') setWalletBalance(walletRes.value);
      if (walletRes.status === 'rejected') console.warn('PayHero wallet balance failed', walletRes.reason);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePaymentChannelSubmit(event: FormEvent) {
    event.preventDefault();
    setPaymentChannelLoading(true);
    setPaymentChannelError('');

    try {
      await createPaymentChannel({
        channel_type: paymentChannelForm.channel_type,
        short_code: paymentChannelForm.short_code.trim(),
        account_number: paymentChannelForm.account_number.trim() || undefined,
        description: paymentChannelForm.description.trim() || undefined,
      });
      setPaymentChannelForm({ channel_type: paymentChannelForm.channel_type, short_code: '', account_number: '', description: '' });
      await loadPaymentChannels();
    } catch (err) {
      setPaymentChannelError(err instanceof Error ? err.message : 'Failed to register payment channel');
    } finally {
      setPaymentChannelLoading(false);
    }
  }

  async function handlePaymentChannelToggle(channel: PaymentChannel) {
    setPaymentChannelError('');
    try {
      await updatePaymentChannel(channel.id, { is_active: !channel.is_active });
      await loadPaymentChannels();
    } catch (err) {
      setPaymentChannelError(err instanceof Error ? err.message : 'Failed to update payment channel');
    }
  }

  async function handlePaymentChannelSync(channelId: number) {
    setPaymentChannelError('');
    try {
      await syncPaymentChannel(channelId);
      await loadPaymentChannels();
    } catch (err) {
      setPaymentChannelError(err instanceof Error ? err.message : 'Failed to sync payment channel');
    }
  }

  async function handlePaymentSettingsSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const propertyId = Number(paymentSettingsForm.property_id);
      const savedSettings = await savePropertyPaymentSettings({
        property_id: propertyId,
        mpesa_paybill: paymentSettingsForm.mpesa_paybill || undefined,
        mpesa_account_number: paymentSettingsForm.mpesa_account_number || undefined,
        mpesa_till: paymentSettingsForm.mpesa_till || undefined,
        mpesa_account_number_format: paymentSettingsForm.mpesa_account_number_format,
        bank_name: paymentSettingsForm.bank_name || undefined,
        bank_account_name: paymentSettingsForm.bank_account_name || undefined,
        bank_account_number: paymentSettingsForm.bank_account_number || undefined,
        bank_reference_format: paymentSettingsForm.bank_reference_format,
        allowed_methods: paymentSettingsForm.allowed_methods,
        notes: paymentSettingsForm.notes || undefined,
      });

      setPaymentSettings((current) => ({ ...current, [propertyId]: savedSettings }));
      setPaymentSettingsForm({
        property_id: '',
        mpesa_paybill: '',
        mpesa_account_number: '',
        mpesa_till: '',
        mpesa_account_number_format: 'tenant_name',
        bank_name: '',
        bank_account_name: '',
        bank_account_number: '',
        bank_reference_format: 'tenant_name',
        allowed_methods: ['mobile_money', 'bank_transfer'],
        notes: '',
      });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment settings save failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleTenantSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createTenant({
        property_id: Number(tenantForm.property_id),
        name: tenantForm.name,
        phone: tenantForm.phone,
        unit_number: tenantForm.unit_number,
        monthly_rent: Number(tenantForm.monthly_rent),
        status: tenantForm.status as 'active' | 'pending' | 'moved_out' | 'archived',
      });

      setTenantForm({ property_id: '', name: '', phone: '', unit_number: '', monthly_rent: '0', status: 'active' });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tenant creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleTenantLifecycleAction(tenantId: number, action: 'moved_out' | 'archived' | 'delete') {
    setLoading(true);
    setError('');

    try {
      if (action === 'delete') {
        await deleteTenant(tenantId);
      } else {
        await updateTenantStatus(tenantId, action);
      }

      setSelectedTenantId(null);
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tenant update failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMaintenanceSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createMaintenanceRequest({
        property_id: Number(maintenanceForm.property_id),
        tenant_id: maintenanceForm.tenant_id ? Number(maintenanceForm.tenant_id) : undefined,
        title: maintenanceForm.title,
        description: maintenanceForm.description,
        priority: maintenanceForm.priority as 'low' | 'medium' | 'high' | 'urgent',
        status: maintenanceForm.status as 'open' | 'in_progress' | 'resolved' | 'closed',
      });

      setMaintenanceForm({ property_id: '', tenant_id: '', title: '', description: '', priority: 'medium', status: 'open' });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Maintenance creation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMaintenanceStatusChange(id: number, status: string) {
    setLoading(true);
    setError('');
    try {
      await updateMaintenanceRequest(id, { status });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMaintenanceEscalate(id: number) {
    setLoading(true);
    setError('');
    try {
      await updateMaintenanceRequest(id, { priority: 'urgent' });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Escalation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMaintenanceDelete(id: number) {
    if (!confirm('Delete this maintenance request?')) return;
    setLoading(true);
    setError('');
    try {
      await deleteMaintenanceRequest(id);
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleStkPush(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await initiateStkPush({
        property_id: Number(stkForm.property_id),
        tenant_id: Number(stkForm.tenant_id),
        phone: stkForm.phone,
        amount: Number(stkForm.amount),
      });
      setError('');
      alert(`STK Push sent: ${res.CustomerMessage || res.ResponseDescription || 'Request sent — check phone'}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'STK Push failed — check M-Pesa sandbox creds');
    } finally {
      setLoading(false);
    }
  }

  async function handleManualPaymentReconciliation(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const propertyId = Number(manualPaymentForm.property_id);
      if (!propertyId) {
        throw new Error('Select a property first.');
      }

      await reconcilePayment({
        property_id: propertyId,
        tenant_name: manualPaymentForm.tenant_name,
        amount: Number(manualPaymentForm.amount),
        payment_method: manualPaymentForm.payment_method,
        reference: manualPaymentForm.reference || manualPaymentForm.tenant_name,
        transaction_ref: manualPaymentForm.transaction_ref || undefined,
        raw_payload: {
          source: 'manual_dashboard_reconciliation',
          payment_method: manualPaymentForm.payment_method,
          tenant_name: manualPaymentForm.tenant_name,
        },
      });

      setManualPaymentForm({
        property_id: '',
        tenant_name: '',
        amount: '0',
        payment_method: 'mobile_money',
        reference: '',
        transaction_ref: '',
      });
      await loadProperties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment reconciliation failed');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setProperties([]);
    setTenants([]);
    setInvoices([]);
    setPayments([]);
    setMaintenance([]);
    setError('');
  }

  const activeTenants = useMemo(() => tenants.filter((t) => t.status === 'active'), [tenants]);

  const maintenanceActionQueue = useMemo(() => {
    const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...maintenance]
      .filter((m) => m.status === 'open' || m.status === 'in_progress')
      .sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [maintenance]);

  const escalatedUrgent = useMemo(() => {
    const now = Date.now();
    return maintenance.filter((m) => m.priority === 'urgent' && (m.status === 'open' || m.status === 'in_progress') && now - new Date(m.created_at).getTime() > 48 * 3600 * 1000);
  }, [maintenance]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f9f5f5] px-4 py-12 text-gray-900">
        <div className="mx-auto max-w-md rounded-3xl border border-[#e8d9d9] bg-white p-8 shadow-[0_20px_60px_rgba(122,20,40,0.08)]">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7A1428]">Rent Sync</p>
            <h1 className="mt-3 text-3xl font-bold text-[#1d1a1a]">Property management</h1>
          </div>

          <div className="mb-6 flex gap-2 rounded-xl bg-[#f7f0f1] p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-[#7A1428] text-white shadow-sm' : 'text-[#5c4d4f] hover:bg-white'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-[#7A1428] text-white shadow-sm' : 'text-[#5c4d4f] hover:bg-white'}`}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full name</label>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                  placeholder="Jane Landlord"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                placeholder="••••••••"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={authForm.role}
                  onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="landlord">Landlord</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.22)] transition hover:bg-[#5c0f1f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>

            {mode === 'login' && (
              <div className="pt-2">
                <div className="mb-3 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
                <div id="google-signin-button" className="flex justify-center" />
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  const getTenantRentStatus = (tenant: Tenant) => {
    const tenantInvoices = invoices.filter((invoice) => invoice.tenant_id === tenant.id);

    if (tenantInvoices.length === 0) {
      return { status: 'pending', amountDue: Number(tenant.monthly_rent), label: 'No invoice' };
    }

    let totalDue = 0;
    let totalPaid = 0;

    tenantInvoices.forEach((invoice) => {
      totalDue += Number(invoice.amount);
      const invoicePayments = payments.filter(
        (payment) => payment.invoice_id === invoice.id && payment.status === 'completed'
      );
      totalPaid += invoicePayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    });

    const balance = Math.max(totalDue - totalPaid, 0);
    const isOverdue = tenantInvoices.some(
      (invoice) => invoice.status === 'overdue' || (invoice.due_date && new Date(invoice.due_date) < new Date() && balance > 0)
    );

    if (balance === 0 && tenantInvoices.some((invoice) => invoice.status === 'paid')) {
      return { status: 'paid', amountDue: 0, label: 'Paid' };
    }

    if (isOverdue) {
      return { status: 'overdue', amountDue: balance, label: 'Overdue' };
    }

    if (tenantInvoices.some((invoice) => invoice.status === 'partial') || balance > 0) {
      return { status: 'partial', amountDue: balance, label: 'Partial' };
    }

    return { status: 'pending', amountDue: balance, label: 'Pending' };
  };

  // Active dashboard must not be polluted by moved_out/archived history — filter to active only

  // Totals for active tenants only — old records (moved_out/archived) keep history but don't inflate outstanding
  const totalCollected = payments
    .filter((p) => p.status === 'completed' && activeTenants.some((t) => t.id === p.tenant_id))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'paid' && activeTenants.some((t) => t.id === inv.tenant_id))
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const recentInvoices = invoices.slice(0, 5);

  const propertySummaries = properties
    .map((property) => {
      const propertyTenants = activeTenants.filter((tenant) => tenant.property_id === property.id);
      const propertyInvoices = invoices.filter(
        (invoice) => invoice.property_id === property.id && activeTenants.some((t) => t.id === invoice.tenant_id)
      );
      const collectedAmount = payments
        .filter((payment) => propertyInvoices.some((invoice) => invoice.id === payment.invoice_id) && payment.status === 'completed')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstandingAmount = propertyInvoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

      const paidCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'paid').length;
      const partialCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'partial').length;
      const overdueCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'overdue').length;

      return {
        property,
        totalUnits: propertyTenants.length,
        paidCount,
        partialCount,
        overdueCount,
        collectedAmount,
        outstandingAmount,
        collectionRate: propertyTenants.length === 0 ? 0 : (paidCount / propertyTenants.length) * 100,
      };
    })
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

  const propertyPaymentStatus = properties.map((property) => {
    const propertyTenants = activeTenants.filter((tenant) => tenant.property_id === property.id);
    const settings = paymentSettings[property.id] ?? null;
    const paidTenants = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'paid');
    const unpaidTenants = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status !== 'paid');
    const paymentChannels: string[] = [];

    if (settings?.mpesa_paybill || settings?.mpesa_account_number) {
      paymentChannels.push(
        `M-Pesa Paybill ${settings?.mpesa_paybill ?? 'N/A'}${settings?.mpesa_account_number ? ` / Account ${settings.mpesa_account_number}` : ''}`
      );
    }
    if (settings?.mpesa_till) paymentChannels.push(`M-Pesa Till ${settings.mpesa_till}`);
    if (settings?.bank_name || settings?.bank_account_number) {
      paymentChannels.push(`${settings.bank_name ?? 'Bank'} ${settings.bank_account_number ?? ''}`.trim());
    }

    return {
      property,
      settings,
      paidTenants,
      unpaidTenants,
      paymentChannels: paymentChannels.length > 0 ? paymentChannels : ['No payment method configured'],
    };
  });

  // Only active tenants in "Needs attention" — moved_out/archived never pollute active view (history kept via invoices/payments)
  const attentionItems = activeTenants
    .map((tenant) => {
      const property = properties.find((item) => item.id === tenant.property_id);
      const status = getTenantRentStatus(tenant);

      return {
        ...tenant,
        propertyName: property?.name ?? 'Unknown property',
        status: status.status,
        label: status.label,
        amountDue: status.amountDue,
      };
    })
    .filter((tenant) => {
      if (attentionPropertyFilter !== 'all' && tenant.property_id !== attentionPropertyFilter) {
        return false;
      }

      const searchTerm = attentionSearch.trim().toLowerCase();
      if (searchTerm) {
        const haystack = `${tenant.name} ${tenant.unit_number} ${tenant.propertyName}`.toLowerCase();
        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      if (attentionFilter === 'all') return tenant.status !== 'paid';
      return tenant.status === attentionFilter;
    })
    .sort((a, b) => {
      const order = { overdue: 0, partial: 1, pending: 2, paid: 3 } as const;
      return (order[a.status as keyof typeof order] ?? 99) - (order[b.status as keyof typeof order] ?? 99)
        || Number(b.amountDue) - Number(a.amountDue);
    });

  // Landlord action queue + escalation (urgent > 48h) — isolated per property via owner_id scoping (maintenance already filtered by owner)

  const selectedTenant = selectedTenantId ? tenants.find((tenant) => tenant.id === selectedTenantId) ?? null : null;
  const selectedTenantInvoices = selectedTenant
    ? invoices
        .filter((invoice) => invoice.tenant_id === selectedTenant.id)
        .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
    : [];
  const selectedTenantPayments = selectedTenant
    ? payments.filter((payment) => payment.tenant_id === selectedTenant.id)
    : [];
  const selectedTenantSummary = selectedTenant ? getTenantRentStatus(selectedTenant) : null;

  return (
    <div className="min-h-screen bg-[#f9f5f5] px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-[#ead7d7] bg-white p-6 shadow-[0_18px_45px_rgba(122,20,40,0.06)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#7A1428]">Rent Sync</p>
            <h1 className="mt-2 text-3xl font-bold text-[#1d1a1a]">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#f7e9eb] px-3 py-1 text-sm font-semibold text-[#7A1428] shadow-sm">
              {user?.role || 'landlord'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-[#e2c7cc] bg-white px-4 py-2 text-sm font-medium text-[#3f2f33] shadow-sm hover:border-[#c98f9d] hover:text-[#7A1428]"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[#ecdfe1] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Properties</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{properties.length}</p>
          </div>
          <div className="rounded-3xl border border-[#f0e3e5] bg-[#fef9f9] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Tenants</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{tenants.length}</p>
          </div>
          <div className="rounded-3xl border border-[#efe1e6] bg-[#fffdfd] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Collected</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">${totalCollected.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-[#f1dfe3] bg-[#fff8f8] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Outstanding</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">${totalOutstanding.toFixed(2)}</p>
          </div>
        </section>

        {properties.length === 0 && (
          <section className="mb-8 rounded-3xl border border-dashed border-[#c98f9d] bg-[#fff5f6] p-6">
            <h2 className="text-lg font-semibold text-[#7A1428]">Welcome — set up your first property</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5c4d4f]">
              As a landlord, start by adding a property (name, address, units, rent due day). Each property is independent — tenants, invoices, and payments are scoped to that property. After you add one, the “Collections by property” and “Paid vs unpaid” cards below will populate, and you can import tenants in bulk.
            </p>
            <p className="mt-2 text-xs text-gray-500">Tip: Due day 5th means invoices auto-generate at month-end for the 5th; tenants see that date.</p>
          </section>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[#efe0e4] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Unmatched</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{reconciliationSummary.unmatched_count}</p>
          </div>
          <div className="rounded-3xl border border-[#efe0e4] bg-[#fffaf9] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Duplicates</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{reconciliationSummary.duplicate_count}</p>
          </div>
          <div className="rounded-3xl border border-[#efe0e4] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Manual review</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{reconciliationSummary.manual_review_count}</p>
          </div>
          <div className="rounded-3xl border border-[#efe0e4] bg-[#fff8f8] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6e5d61]">Matched</p>
            <p className="mt-3 text-3xl font-bold text-[#1d1a1a]">{reconciliationSummary.matched_count}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1d1a1a]">Collections by property</h2>
              <span className="rounded-full bg-[#f7e9eb] px-2.5 py-1 text-xs font-semibold text-[#7A1428]">{properties.length} total</span>
            </div>

            {propertySummaries.length === 0 ? (
              <p className="text-gray-500">No properties yet. Add one to get started.</p>
            ) : (
              <div className="space-y-4">
                {propertySummaries.map(({ property, totalUnits, paidCount, partialCount, overdueCount, collectedAmount, outstandingAmount, collectionRate }) => (
                  <div key={property.id} className="rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#1d1a1a]">{property.name}</h3>
                        <p className="text-sm text-[#615759]">{property.address}</p>
                      </div>
                      <span className="rounded-full bg-[#edf7f1] px-2.5 py-1 text-xs font-semibold text-[#1e6b4d]">
                        {property.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-600 md:grid-cols-4">
                      <p>Units: {totalUnits}</p>
                      <p>Paid: {paidCount}</p>
                      <p>Partial: {partialCount}</p>
                      <p>Overdue: {overdueCount}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-[#f7f0f1] p-3">
                        <p className="text-[#6e5d61]">Collected</p>
                        <p className="mt-1 font-semibold text-[#1d1a1a]">${collectedAmount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-[#fff5f5] p-3">
                        <p className="text-[#6e5d61]">Outstanding</p>
                        <p className="mt-1 font-semibold text-[#1d1a1a]">${outstandingAmount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
                        <span>Collection rate</span>
                        <span>{Math.round(collectionRate)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#f3e4e7]">
                        <div
                          className="h-full rounded-full bg-[#7A1428]"
                          style={{ width: `${Math.min(collectionRate, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePropertyEditStart(property)}
                        className="rounded-full border border-[#e2c7cc] bg-white px-3 py-1 text-xs font-medium text-[#3f2f33] hover:border-[#c98f9d] hover:text-[#7A1428]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePropertyDelete(property.id)}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                      <span className="ml-auto text-xs text-gray-500">Due: {property.rent_due_day ?? 5}th • {property.units} units</span>
                    </div>

                    {editingPropertyId === property.id && (
                      <form onSubmit={handlePropertyUpdate} className="mt-4 space-y-3 rounded-xl border border-[#e9d7da] bg-white p-4">
                        <p className="text-sm font-semibold text-[#1d1a1a]">Edit property — independent (only this property changes)</p>
                        <input
                          value={editPropertyForm.name}
                          onChange={(e) => setEditPropertyForm({ ...editPropertyForm, name: e.target.value })}
                          placeholder="Property name"
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${propertyErrors.name ? 'border-red-300' : 'border-gray-200'}`}
                        />
                        {propertyErrors.name && <p className="text-xs text-red-600">{propertyErrors.name}</p>}
                        <input
                          value={editPropertyForm.address}
                          onChange={(e) => setEditPropertyForm({ ...editPropertyForm, address: e.target.value })}
                          placeholder="Address"
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${propertyErrors.address ? 'border-red-300' : 'border-gray-200'}`}
                        />
                        {propertyErrors.address && <p className="text-xs text-red-600">{propertyErrors.address}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="1"
                            value={editPropertyForm.units}
                            onChange={(e) => setEditPropertyForm({ ...editPropertyForm, units: e.target.value })}
                            className={`rounded-lg border px-3 py-2 text-sm ${propertyErrors.units ? 'border-red-300' : 'border-gray-200'}`}
                          />
                          <select
                            value={editPropertyForm.rent_due_day}
                            onChange={(e) => setEditPropertyForm({ ...editPropertyForm, rent_due_day: e.target.value })}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                              <option key={d} value={d}>{d}th</option>
                            ))}
                          </select>
                        </div>
                        {propertyErrors.units && <p className="text-xs text-red-600">{propertyErrors.units}</p>}
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-[#7A1428] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Save</button>
                          <button type="button" onClick={() => { setEditingPropertyId(null); setPropertyErrors({}); }} className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-[#1d1a1a]">Needs attention</h2>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  {(['all', 'overdue', 'partial', 'paid'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAttentionFilter(filter)}
                      className={`rounded-full px-2.5 py-1.5 capitalize ${attentionFilter === filter ? 'bg-[#7A1428] text-white' : 'bg-[#f7e9eb] text-[#7A1428]'}`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <input
                  value={attentionSearch}
                  onChange={(event) => setAttentionSearch(event.target.value)}
                  placeholder="Search tenant, unit, or property"
                  className="w-full rounded-xl border border-[#ecdfe3] bg-[#fffaf9] px-3 py-2.5 text-sm text-gray-700 outline-none ring-0"
                />

                <select
                  value={attentionPropertyFilter}
                  onChange={(event) => setAttentionPropertyFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                  className="w-full rounded-xl border border-[#ecdfe3] bg-[#fffaf9] px-3 py-2.5 text-sm text-gray-700 outline-none ring-0"
                >
                  <option value="all">All properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {attentionItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#ebd8dc] bg-[#fffaf9] p-4 text-sm text-gray-500">
                  No tenants need attention right now.
                </p>
              ) : (
                attentionItems.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-4 text-left transition hover:border-[#d6a0ad] hover:bg-[#fff6f7]"
                  >
                    <div>
                      <p className="font-semibold text-[#1d1a1a]">{tenant.name}</p>
                      <p className="text-sm text-[#62585a]">
                        {tenant.propertyName} • Unit {tenant.unit_number}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tenant.status === 'overdue' ? 'bg-red-100 text-red-700' : tenant.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                      >
                        {tenant.label}
                      </span>
                      <p className="mt-2 text-sm font-medium text-[#1d1a1a]">${Number(tenant.amountDue).toFixed(2)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#1d1a1a]">Paid vs unpaid by property</h2>
            <span className="rounded-full bg-[#f7e9eb] px-2.5 py-1 text-xs font-semibold text-[#7A1428]">{propertyPaymentStatus.length} properties</span>
          </div>

          <div className="space-y-4">
            {propertyPaymentStatus.map(({ property, paidTenants, unpaidTenants, paymentChannels }) => (
              <div key={property.id} className="rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1d1a1a]">{property.name}</h3>
                    <p className="text-sm text-[#615759]">{property.address}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {paymentChannels.map((channel) => (
                      <span key={channel} className="rounded-full bg-[#f4e0e5] px-2.5 py-1 font-medium text-[#7A1428]">{channel}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-[#edf7f1] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#1e6b4d]">Paid</p>
                    <p className="mt-2 text-lg font-bold text-[#1d1a1a]">{paidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#1d1a1a]">
                      {paidTenants.length === 0 ? (
                        <span className="text-[#5f6a67]">No tenant has paid yet</span>
                      ) : (
                        paidTenants.map((tenant) => <span key={tenant.id} className="rounded-full bg-white px-2 py-1">{tenant.name}</span>)
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fff4f4] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a33f4d]">Not paid</p>
                    <p className="mt-2 text-lg font-bold text-[#1d1a1a]">{unpaidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#1d1a1a]">
                      {unpaidTenants.length === 0 ? (
                        <span className="text-[#676064]">All tenants are fully paid</span>
                      ) : (
                        unpaidTenants.map((tenant) => <span key={tenant.id} className="rounded-full bg-white px-2 py-1">{tenant.name}</span>)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#1d1a1a]">Recent invoices</h2>
            <span className="rounded-full bg-[#f7e9eb] px-2.5 py-1 text-xs font-semibold text-[#7A1428]">{recentInvoices.length} latest</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#f0e1e5]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f9f2f3] text-[#4d3d41]">
                <tr>
                  <th className="px-3 py-2 font-medium">Invoice</th>
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-gray-500">No invoices yet</td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-gray-200">
                      <td className="px-3 py-2">{invoice.invoice_number}</td>
                      <td className="px-3 py-2">{invoice.tenant_name || '—'}</td>
                      <td className="px-3 py-2">${Number(invoice.amount).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{invoice.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#1d1a1a]">Payment alerts</h2>
            <span className="rounded-full bg-[#f7e9eb] px-2.5 py-1 text-xs font-semibold text-[#7A1428]">{reconciliationAlerts.length} entries</span>
          </div>
          <div className="space-y-3">
            {reconciliationAlerts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#ebd8dc] bg-[#fffaf9] p-4 text-sm text-gray-500">No reconciliation alerts.</p>
            ) : (
              reconciliationAlerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#1d1a1a]">{alert.tenant_name || alert.invoice_number || 'Unknown tenant'}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${alert.match_status === 'unmatched' ? 'bg-red-100 text-red-700' : alert.match_status === 'duplicate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {alert.match_status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#62585a]">
                    {alert.property_name ? `${alert.property_name} • ` : ''}
                    {alert.invoice_number ? `Invoice ${alert.invoice_number} • ` : ''}
                    {alert.transaction_ref || 'No reference'}
                  </p>
                  <p className="mt-1 text-xs text-[#7b5f64]">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <h2 className="text-xl font-semibold text-[#1d1a1a]">Manual payment reconciliation</h2>
          <p className="mt-2 text-sm text-[#64585a]">Use this when a tenant pays by bank transfer or an unmatched M-Pesa reference needs to be linked to the correct tenant.</p>
          <form className="mt-4 space-y-4" onSubmit={handleManualPaymentReconciliation}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property</label>
              <select
                value={manualPaymentForm.property_id}
                onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, property_id: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tenant name</label>
                <input
                  value={manualPaymentForm.tenant_name}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, tenant_name: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                  placeholder="Jane Mwangi"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPaymentForm.amount}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, amount: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment method</label>
                <select
                  value={manualPaymentForm.payment_method}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, payment_method: event.target.value as 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other' })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="mobile_money">M-Pesa / mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Transaction reference</label>
                <input
                  value={manualPaymentForm.transaction_ref}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, transaction_ref: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                  placeholder="MPESA-12345 or bank transfer ref"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reference note</label>
              <input
                value={manualPaymentForm.reference}
                onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, reference: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                placeholder="Jane Mwangi"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Reconciling payment...' : 'Match payment to tenant'}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <h2 className="text-xl font-semibold text-[#1d1a1a]">Add property</h2>
          <form className="mt-4 space-y-4" onSubmit={handlePropertySubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property name</label>
              <input
                value={propertyForm.name}
                onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })}
                className={`w-full rounded-lg border bg-white px-3 py-2 ${propertyErrors.name ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="Sunset Apartments"
                aria-invalid={!!propertyErrors.name}
              />
              {propertyErrors.name && <p className="mt-1 text-xs text-red-600">{propertyErrors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
              <input
                value={propertyForm.address}
                onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })}
                className={`w-full rounded-lg border bg-white px-3 py-2 ${propertyErrors.address ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="12 River Road"
                aria-invalid={!!propertyErrors.address}
              />
              {propertyErrors.address && <p className="mt-1 text-xs text-red-600">{propertyErrors.address}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Units</label>
              <input
                type="number"
                min="1"
                value={propertyForm.units}
                onChange={(event) => setPropertyForm({ ...propertyForm, units: event.target.value })}
                className={`w-full rounded-lg border bg-white px-3 py-2 ${propertyErrors.units ? 'border-red-300' : 'border-gray-200'}`}
                aria-invalid={!!propertyErrors.units}
              />
              {propertyErrors.units && <p className="mt-1 text-xs text-red-600">{propertyErrors.units}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rent due day (landlord dictates)</label>
              <select
                value={propertyForm.rent_due_day}
                onChange={(event) => setPropertyForm({ ...propertyForm, rent_due_day: event.target.value })}
                className={`w-full rounded-lg border bg-white px-3 py-2 ${propertyErrors.rent_due_day ? 'border-red-300' : 'border-gray-200'}`}
                aria-invalid={!!propertyErrors.rent_due_day}
              >
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                  <option key={d} value={d}>{d}th of each month</option>
                ))}
              </select>
              {propertyErrors.rent_due_day && <p className="mt-1 text-xs text-red-600">{propertyErrors.rent_due_day}</p>}
              <p className="mt-1 text-xs text-gray-500">Tenants know this day; invoices auto-generate at month-end for next due date (no manual Create invoice).</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save property'}
            </button>
          </form>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
            <h2 className="text-xl font-semibold text-[#1d1a1a]">Property payment settings</h2>
            <form className="mt-4 space-y-4" onSubmit={handlePaymentSettingsSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Property</label>
                <select
                  value={paymentSettingsForm.property_id}
                  onChange={(event) => {
                    const propertyId = event.target.value;
                    setPaymentSettingsForm((current) => ({ ...current, property_id: propertyId }));
                    if (propertyId) {
                      const selectedProperty = properties.find((property) => String(property.id) === propertyId);
                      const settings = paymentSettings[Number(propertyId)];
                      if (selectedProperty && settings) {
                        setPaymentSettingsForm((current) => ({
                          ...current,
                          property_id: propertyId,
                          mpesa_paybill: settings.mpesa_paybill ?? '',
                          mpesa_account_number: settings.mpesa_account_number ?? '',
                          mpesa_till: settings.mpesa_till ?? '',
                          mpesa_account_number_format: settings.mpesa_account_number_format,
                          bank_name: settings.bank_name ?? '',
                          bank_account_name: settings.bank_account_name ?? '',
                          bank_account_number: settings.bank_account_number ?? '',
                          bank_reference_format: settings.bank_reference_format,
                          allowed_methods: settings.allowed_methods ?? ['mobile_money', 'bank_transfer'],
                          notes: settings.notes ?? '',
                        }));
                      }
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">M-Pesa Paybill</label>
                  <input value={paymentSettingsForm.mpesa_paybill} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, mpesa_paybill: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Account Number</label>
                  <input value={paymentSettingsForm.mpesa_account_number} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, mpesa_account_number: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">M-Pesa Till</label>
                <input value={paymentSettingsForm.mpesa_till} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, mpesa_till: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">M-Pesa reference format</label>
                <select value={paymentSettingsForm.mpesa_account_number_format} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, mpesa_account_number_format: event.target.value as 'invoice_number' | 'tenant_name' | 'custom' })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <option value="invoice_number">Invoice number</option>
                  <option value="tenant_name">Tenant name</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bank name</label>
                  <input value={paymentSettingsForm.bank_name} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, bank_name: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Bank account name</label>
                  <input value={paymentSettingsForm.bank_account_name} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, bank_account_name: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bank account number</label>
                <input value={paymentSettingsForm.bank_account_number} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, bank_account_number: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bank reference format</label>
                <select value={paymentSettingsForm.bank_reference_format} onChange={(event) => setPaymentSettingsForm({ ...paymentSettingsForm, bank_reference_format: event.target.value as 'invoice_number' | 'tenant_name' | 'custom' })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <option value="invoice_number">Invoice number</option>
                  <option value="tenant_name">Tenant name</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Allowed methods</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(['mobile_money', 'bank_transfer', 'cash', 'card', 'other'] as const).map((method) => {
                    const selected = paymentSettingsForm.allowed_methods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setPaymentSettingsForm((current) => ({
                            ...current,
                            allowed_methods: selected
                              ? current.allowed_methods.filter((item) => item !== method)
                              : [...current.allowed_methods, method],
                          }));
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-[#7A1428] text-white' : 'bg-[#f7e9eb] text-[#7A1428]'}`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.16)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Saving...' : 'Save payment settings'}</button>
            </form>
          </section>

          <section className="rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#1d1a1a]">Payment Channels (PayHero)</h2>
              <button type="button" onClick={loadPaymentChannels} className="rounded-full bg-[#f7e9eb] px-3 py-1.5 text-xs font-semibold text-[#7A1428]">Refresh</button>
            </div>

            {walletBalance && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${walletBalance.low ? 'border-red-200 bg-red-50 text-red-800' : 'border-[#e9d7da] bg-[#f7e9eb]/50 text-[#5C0F1F]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">PayHero service wallet balance</span>
                  <span className="font-semibold">{walletBalance.currency} {walletBalance.available_balance.toLocaleString()}</span>
                </div>
                {walletBalance.low
                  ? <p className="mt-1 text-xs font-medium">Low balance — PayHero uses a prepaid wallet; a depleted wallet silently blocks new transactions. Top it up in the PayHero portal.</p>
                  : <p className="mt-1 text-xs text-[#6B6B6B]">Prepaid wallet threshold for warning: {walletBalance.currency} {walletBalance.threshold.toLocaleString()}.</p>}
              </div>
            )}

            <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={handlePaymentChannelSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Channel type</label>
                <select value={paymentChannelForm.channel_type} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, channel_type: event.target.value as 'paybill' | 'till' | 'bank' })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <option value="paybill">Paybill</option>
                  <option value="till">Till</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Short code / Paybill / Till / Bank number</label>
                <input value={paymentChannelForm.short_code} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, short_code: event.target.value })} placeholder="e.g. 522522" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Account number (bank / paybill account — optional)</label>
                <input value={paymentChannelForm.account_number} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, account_number: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <input value={paymentChannelForm.description} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, description: event.target.value })} placeholder="e.g. Main Paybill" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={paymentChannelLoading || !paymentChannelForm.short_code.trim()} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.16)] disabled:cursor-not-allowed disabled:opacity-60">
                  {paymentChannelLoading ? 'Registering with PayHero...' : 'Add payment channel'}
                </button>
                {paymentChannelError && <p className="mt-2 text-xs text-red-600">{paymentChannelError}</p>}
              </div>
            </form>

            {paymentChannels.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No payment channels yet. Add a Paybill, Till, or Bank channel above — PayHero requires an ownership-confirmation step before incoming payments activate.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {paymentChannels.map((channel) => (
                  <li key={channel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#1d1a1a]">{channel.description || channel.short_code}</span>
                        <span className="rounded-full bg-[#f7e9eb] px-2 py-0.5 text-xs font-semibold text-[#7A1428] uppercase">{channel.channel_type}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${channel.verification_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{channel.verification_status}</span>
                        {!channel.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">deactivated</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        Short code: {channel.short_code}
                        {channel.payhero_channel_id ? ` · PayHero channel id: ${channel.payhero_channel_id}` : ' · not yet confirmed by PayHero'}
                        {channel.account_number ? ` · Acct: ${channel.account_number}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handlePaymentChannelSync(channel.id)} className="rounded-full border border-[#e9d7da] px-3 py-1 text-xs font-semibold text-[#5C0F1F]">Sync status</button>
                      <button
                        type="button"
                        onClick={() => handlePaymentChannelToggle(channel)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${channel.is_active ? 'bg-[#7A1428] text-white' : 'bg-[#f7e9eb] text-[#7A1428]'}`}
                      >
                        {channel.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
            <h2 className="text-xl font-semibold text-[#1d1a1a]">Add tenant</h2>
            <form className="mt-4 space-y-4" onSubmit={handleTenantSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Property</label>
                <select
                  value={tenantForm.property_id}
                  onChange={(event) => setTenantForm({ ...tenantForm, property_id: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input value={tenantForm.name} onChange={(event) => setTenantForm({ ...tenantForm, name: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <input value={tenantForm.phone} onChange={(event) => setTenantForm({ ...tenantForm, phone: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
                  <input value={tenantForm.unit_number} onChange={(event) => setTenantForm({ ...tenantForm, unit_number: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Rent</label>
                  <input type="number" value={tenantForm.monthly_rent} onChange={(event) => setTenantForm({ ...tenantForm, monthly_rent: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#5c0f1f] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(92,15,31,0.18)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Saving...' : 'Add tenant'}</button>
            </form>
          </section>

        </div>

        <div className="mt-8">
          <BulkTenantImport properties={properties} tenants={tenants} onImported={loadProperties} />
        </div>

        <section className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <h2 className="text-xl font-semibold text-[#1d1a1a]">M-Pesa STK Push — sandbox test (Phase 6)</h2>
          <p className="mt-1 text-sm text-gray-500">Prompts tenant phone to pay. Mocked if no MPESA_* creds — use the duplicate test script for callback.</p>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleStkPush}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property</label>
              <select value={stkForm.property_id} onChange={(e) => setStkForm({ ...stkForm, property_id: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tenant</label>
              <select value={stkForm.tenant_id} onChange={(e) => setStkForm({ ...stkForm, tenant_id: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="">Select tenant</option>
                {tenants.filter((t) => !stkForm.property_id || String(t.property_id) === stkForm.property_id).map((t) => <option key={t.id} value={t.id}>{t.name} — {t.unit_number}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone (2547...)</label>
              <input value={stkForm.phone} onChange={(e) => setStkForm({ ...stkForm, phone: e.target.value })} placeholder="254712345678" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
              <input type="number" value={stkForm.amount} onChange={(e) => setStkForm({ ...stkForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? 'Sending...' : 'Send STK Push'}</button>
              <p className="mt-2 text-xs text-gray-500">Sandbox: without MPESA_* it returns mock CheckoutRequestID — then run <code>node backend/scripts/test-mpesa-duplicate.js</code> to simulate duplicate callback.</p>
            </div>
          </form>
        </section>

        {selectedTenant && selectedTenantSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[#ecdfe3] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7A1428]">Tenant details</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#1d1a1a]">{selectedTenant.name}</h3>
                  <p className="text-sm text-[#62585a]">
                    {properties.find((property) => property.id === selectedTenant.property_id)?.name ?? 'Unknown property'} • Unit {selectedTenant.unit_number}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTenantId(null)}
                  className="rounded-full border border-[#e4c9ce] bg-[#fff7f8] px-3 py-1.5 text-sm font-medium text-[#593d43]"
                >
                  Close
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#f9f2f3] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#7b5f64]">Status</p>
                  <p className="mt-2 text-lg font-semibold text-[#1d1a1a]">{selectedTenantSummary.label}</p>
                </div>
                <div className="rounded-2xl bg-[#f9f2f3] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#7b5f64]">Total due</p>
                  <p className="mt-2 text-lg font-semibold text-[#1d1a1a]">${Number(selectedTenantSummary.amountDue).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-[#f9f2f3] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#7b5f64]">Monthly rent</p>
                  <p className="mt-2 text-lg font-semibold text-[#1d1a1a]">${Number(selectedTenant.monthly_rent).toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'moved_out')}
                  disabled={loading}
                  className="rounded-xl border border-[#d9aab2] bg-[#fff4f6] px-3 py-2 text-sm font-medium text-[#7A1428] disabled:opacity-60"
                >
                  Mark moved out
                </button>
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'archived')}
                  disabled={loading}
                  className="rounded-xl border border-[#d9aab2] bg-white px-3 py-2 text-sm font-medium text-[#593d43] disabled:opacity-60"
                >
                  Archive tenant
                </button>
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'delete')}
                  disabled={loading}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                >
                  Delete tenant
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-lg font-semibold text-[#1d1a1a]">Invoices</h4>
                  <div className="space-y-3">
                    {selectedTenantInvoices.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[#ebd8dc] bg-[#fffaf9] p-3 text-sm text-gray-500">No invoices yet.</p>
                    ) : (
                      selectedTenantInvoices.map((invoice) => {
                        const invoicePayments = payments.filter((payment) => payment.invoice_id === invoice.id);
                        const invoicePaid = invoicePayments
                          .filter((payment) => payment.status === 'completed')
                          .reduce((sum, payment) => sum + Number(payment.amount), 0);

                        return (
                          <div key={invoice.id} className="rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-[#1d1a1a]">{invoice.invoice_number}</p>
                              <span className="rounded-full bg-[#f7e9eb] px-2 py-1 text-[11px] font-semibold text-[#7A1428] uppercase">
                                {invoice.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#62585a]">Due: {invoice.due_date}</p>
                            <p className="text-sm text-[#62585a]">Amount: ${Number(invoice.amount).toFixed(2)}</p>
                            <p className="text-sm text-[#62585a]">Paid: ${invoicePaid.toFixed(2)}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-lg font-semibold text-[#1d1a1a]">Payment history</h4>
                  <div className="space-y-3">
                    {selectedTenantPayments.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[#ebd8dc] bg-[#fffaf9] p-3 text-sm text-gray-500">No payments recorded.</p>
                    ) : (
                      selectedTenantPayments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-[#eedfe3] bg-[#fffaf9] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-[#1d1a1a]">${Number(payment.amount).toFixed(2)}</p>
                            <span className="rounded-full bg-[#edf7f1] px-2 py-1 text-[11px] font-semibold text-[#1e6b4d] uppercase">
                              {payment.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#62585a]">Method: {payment.payment_method}</p>
                          <p className="text-sm text-[#62585a]">Reference: {payment.reference || '—'}</p>
                          <p className="text-sm text-[#62585a]">Paid: {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-[#e9d7da] bg-white p-6 shadow-[0_12px_26px_rgba(122,20,40,0.04)]">
          <h2 className="text-xl font-semibold text-[#1d1a1a]">Maintenance</h2>
          <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={handleMaintenanceSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Property</label>
              <select value={maintenanceForm.property_id} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, property_id: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tenant</label>
              <select value={maintenanceForm.tenant_id} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, tenant_id: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="">Optional tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
              <input value={maintenanceForm.title} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, title: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select value={maintenanceForm.priority} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, priority: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea value={maintenanceForm.description} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2" />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select value={maintenanceForm.status} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, status: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(122,20,40,0.16)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Saving...' : 'Create maintenance request'}</button>
            </div>
          </form>

          {/* Landlord action queue + escalation */}
          {maintenanceActionQueue.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-800">Landlord action queue — {maintenanceActionQueue.length} open</h3>
              <p className="mt-1 text-xs text-amber-700">Filtered by your properties only (owner_id isolation). Urgent first, then by age.</p>
              {escalatedUrgent.length > 0 && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">⚠ {escalatedUrgent.length} urgent repair(s) older than 48h — escalated</p>
              )}
              <div className="mt-3 space-y-2">
                {maintenanceActionQueue.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                    <span><span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${item.priority === 'urgent' ? 'bg-red-100 text-red-700' : item.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{item.priority}</span> {item.title} • {item.property_name}</span>
                    <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maintenance.length > 0 && (
            <div className="mt-6 space-y-3">
              {maintenance.map((item) => {
                const isEscalated = item.priority === 'urgent' && item.status !== 'resolved' && item.status !== 'closed' && Date.now() - new Date(item.created_at).getTime() > 48 * 3600 * 1000;
                return (
                  <div key={item.id} className={`rounded-xl border p-4 ${isEscalated ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{item.title} {isEscalated && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">Escalated</span>}</h3>
                        <p className="text-sm text-gray-500">{item.property_name || 'Property'} • {item.tenant_name || 'No tenant'} — isolated to your properties</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{item.priority}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                    <p className="mt-1 text-xs text-gray-500">Status: <span className="font-medium text-ink">{item.status}</span> • Created {new Date(item.created_at).toLocaleString()}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === 'open' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'in_progress')} className="rounded-full bg-[#7A1428] px-3 py-1 text-xs font-semibold text-white">Start → In progress</button>}
                      {item.status === 'in_progress' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'resolved')} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Resolve</button>}
                      {item.status === 'resolved' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'closed')} className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">Close</button>}
                      {item.priority !== 'urgent' && item.status !== 'closed' && item.status !== 'resolved' && <button type="button" onClick={() => handleMaintenanceEscalate(item.id)} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700">Escalate to urgent</button>}
                      <button type="button" onClick={() => handleMaintenanceDelete(item.id)} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
