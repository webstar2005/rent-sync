import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { googleLogin, login, logout, register, type AuthUser } from './lib/api/auth';
import { getApiHealth } from './lib/api/client';
import { createProperty, getProperties, updateProperty, deleteProperty, type Property } from './lib/api/properties';
import { createTenant, deleteTenant, getTenants, updateTenantStatus, type Tenant } from './lib/api/tenants';
import { getInvoices, generateInvoices, type Invoice } from './lib/api/invoices';
import { getPayments, type Payment } from './lib/api/payments';
import { createMaintenanceRequest, getMaintenanceRequests, updateMaintenanceRequest, deleteMaintenanceRequest, type MaintenanceRequest } from './lib/api/maintenance';
import { getPayHeroWalletBalance, createPaymentChannel, getPaymentChannels, syncPaymentChannel, updatePaymentChannel, type PaymentChannel, type WalletBalance } from './lib/api/channels';
import { getReconciliationAlerts, getReconciliationSummary, reconcilePayment, type ReconciliationAlert } from './lib/api/reconciliation';
import {
  getArrears,
  getCollectionRate,
  getTenantStatement,
  downloadArrearsCsv,
  downloadCollectionRateCsv,
  downloadTenantStatementCsv,
  type ArrearsRow,
  type CollectionRateRow,
  type TenantStatement,
} from './lib/api/reports';
import { BulkTenantImport } from './components/BulkTenantImport';

type Mode = 'login' | 'register';

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [gsiReady, setGsiReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [invoiceNotice, setInvoiceNotice] = useState('');
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
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    address: '',
    units: '1',
    rent_due_day: '5',
  });
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const [deletingPropertyId, setDeletingPropertyId] = useState<number | null>(null);
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
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelForm, setPaymentChannelForm] = useState({ channel_type: 'paybill' as 'paybill' | 'till' | 'bank' | 'send_money', short_code: '', account_number: '', description: '' });
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [paymentChannelError, setPaymentChannelError] = useState('');
  const [paymentChannelLoading, setPaymentChannelLoading] = useState(false);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [collectionRate, setCollectionRate] = useState<CollectionRateRow[]>([]);
  const [reportPropertyFilter, setReportPropertyFilter] = useState<'all' | number>('all');
  const [reportStatementTenantId, setReportStatementTenantId] = useState<number | ''>('');
  const [tenantStatement, setTenantStatement] = useState<TenantStatement | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

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
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    const markReady = () => setGsiReady(true);

    if (existingScript) {
      if (window.google?.accounts?.id) {
        markReady();
      } else {
        existingScript.addEventListener('load', markReady);
      }
      return () => existingScript.removeEventListener('load', markReady);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', markReady);
    document.body.appendChild(script);

    return () => script.removeEventListener('load', markReady);
  }, []);

  useEffect(() => {
    if (mode !== 'login' || !gsiReady || !window.google?.accounts?.id || !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
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

    container.innerHTML = '';
    const width = Math.max(180, Math.min(400, Math.round(container.getBoundingClientRect().width)));
    googleId.renderButton(container, {
      theme: 'filled_black',
      size: 'large',
      width,
      text: 'continue_with',
      shape: 'rectangle',
      logo_alignment: 'left',
    });  }, [mode, gsiReady]);

  useEffect(() => {
    const savedUser = localStorage.getItem('property_app_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    if (isLoggedIn) {
      loadProperties();
      loadPaymentChannels();
      getArrears().then(setArrears).catch(() => setArrears([]));
      getCollectionRate().then(setCollectionRate).catch(() => undefined);
    }
  }, [isLoggedIn]);

  async function loadProperties(silent = false) {
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
    } catch (err) {
      console.error(err);

      if (silent) return;

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

  async function handleTenantsImported(importedTenants?: Tenant[]) {
    if (importedTenants && importedTenants.length > 0) {
      setTenants((prev) => [
        ...importedTenants.filter((t) => !prev.some((existing) => existing.id === t.id)),
        ...prev,
      ]);
    }
    await loadProperties(true);
  }

  async function handleGenerateInvoices() {
    setGeneratingInvoices(true);
    setError('');
    setInvoiceNotice('');
    try {
      const result = await generateInvoices();
      const core = result.generated > 0
        ? `Generated ${result.generated} invoice(s) for ${result.period}.`
        : `No new invoices for ${result.period} — that period is already billed.`;
      setInvoiceNotice(result.overdue_marked > 0 ? `${core} Marked ${result.overdue_marked} overdue.` : core);
      await loadProperties();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('401') || msg.includes('Forbidden')) setError('You need a landlord account to generate invoices.');
      else setError(`Generate failed: ${msg}`);
    } finally {
      setGeneratingInvoices(false);
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
    setDeletingPropertyId(propertyId);
    setError('');
    try {
      await deleteProperty(propertyId);
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
      await loadProperties(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Property delete failed');
      await loadProperties(false);
    } finally {
      setDeletingPropertyId(null);
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

  async function loadReports() {
    setReportsLoading(true);
    setReportsError('');
    try {
      const [arrearsRes, rateRes] = await Promise.allSettled([
        getArrears(reportPropertyFilter === 'all' ? undefined : reportPropertyFilter),
        getCollectionRate(),
      ]);
      if (arrearsRes.status === 'fulfilled') setArrears(arrearsRes.value);
      else if (reportPropertyFilter === 'all') setArrears([]);
      if (arrearsRes.status === 'rejected') console.warn('arrears failed', arrearsRes.reason);
      if (rateRes.status === 'fulfilled') setCollectionRate(rateRes.value);
      if (rateRes.status === 'rejected') console.warn('collection rate failed', rateRes.reason);
      if (arrearsRes.status === 'rejected' && rateRes.status === 'rejected') {
        setReportsError('Unable to load reports — is the backend reachable?');
      }
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleTenantStatementLoad() {
    if (!reportStatementTenantId) return;
    setReportsError('');
    try {
      setTenantStatement(await getTenantStatement(Number(reportStatementTenantId)));
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : 'Failed to load tenant statement');
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
    void logout();
    setUser(null);
    setProperties([]);
    setTenants([]);
    setInvoices([]);
    setPayments([]);
    setMaintenance([]);
    setArrears([]);
    setCollectionRate([]);
    setTenantStatement(null);
    setReportStatementTenantId('');
    setReportsError('');
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
      <div className="min-h-screen bg-[#0D0A0B] px-4 py-12 text-[#F6F2F3]">
        <div className="mx-auto max-w-md rounded-3xl border border-[#261F22] bg-[#161112] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C65A70]">Rent Sync</p>
            <h1 className="mt-3 text-3xl font-bold text-[#F6F2F3]">Property management</h1>
          </div>

          <div className="mb-6 flex gap-2 rounded-xl bg-[#221C1E] p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`no-scale flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-[#7A1428] text-white shadow-sm' : 'text-[#C9C0C4] hover:bg-[#221C1E]'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`no-scale flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-[#7A1428] text-white shadow-sm' : 'text-[#C9C0C4] hover:bg-[#221C1E]'}`}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Full name</label>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                  placeholder="Jane Landlord"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Email</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2 pr-11"
                  placeholder={showPassword ? 'Your password' : '••••••••'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="no-scale absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[#8A7F83] hover:text-[#C9C0C4] focus:outline-none focus-visible:text-[#C65A70]"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 5.2A9.7 9.7 0 0112 5c5 0 9 4.5 9 7a12.6 12.6 0 01-2.2 3.2" />
                      <path d="M6.6 6.6A12.6 12.6 0 003 12c0 2.5 4 7 9 7a9.6 9.6 0 003.6-.7" />
                      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Role</label>
                <select
                  disabled
                  value="landlord"
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2 opacity-70"
                >
                  <option value="landlord">Landlord</option>
                </select>
                <p className="mt-1 text-xs text-[#8A7F83]">New accounts are always registered as Landlord. Privileged roles are granted by an existing admin.</p>
              </div>
            )}

            {error && <p className="text-sm text-[#F47C8E]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition hover:bg-[#8E1A30] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>

            {mode === 'login' && (
              <div className="pt-2">
                <div className="mb-3 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-[#8A8085]">
                  <span className="h-px flex-1 bg-[#2A2225]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[#2A2225]" />
                </div>
                <div id="google-signin-wrap" className="relative h-11 w-full">
                  <div
                    id="google-signin-button"
                    className="absolute inset-0 z-10 h-11 w-full opacity-0"
                    aria-hidden="true"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-[#0B0B0C] text-sm font-semibold text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" focusable="false" aria-hidden="true">
                      <path
                        fill="#FFFFFF"
                        d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
                      />
                    </svg>
                    Continue with Google
                  </div>
                </div>
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
    const paidTenants = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'paid');
    const unpaidTenants = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status !== 'paid');
    const channelLabels = paymentChannels.length > 0
      ? paymentChannels.map((channel) => channel.description || channel.short_code)
      : ['No payment channel registered'];

    return {
      property,
      paidTenants,
      unpaidTenants,
      paymentChannels: channelLabels,
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
    <div className="min-h-screen bg-[#0D0A0B] px-4 py-8 text-[#F6F2F3]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-[#261F22] bg-[#161112] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.5)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C65A70]">Rent Sync</p>
            <h1 className="mt-2 text-3xl font-bold text-[#F6F2F3]">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#2B1A1E] px-3 py-1 text-sm font-semibold text-[#C65A70] shadow-sm">
              {user?.role || 'landlord'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-[#33282C] bg-[#161112] px-4 py-2 text-sm font-medium text-[#CFC5CA] shadow-sm hover:border-[#7A3B4C] hover:text-[#C65A70]"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[#261F22] bg-[#161112] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Properties</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{properties.length}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#201A1C] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Tenants</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{tenants.length}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#201A1C] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Collected</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">${totalCollected.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#201A1C] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Outstanding</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">${totalOutstanding.toFixed(2)}</p>
          </div>
        </section>

        {properties.length === 0 && (
          <section className="mb-8 rounded-3xl border border-dashed border-[#7A3B4C] bg-[#1C1618] p-6">
            <h2 className="text-lg font-semibold text-[#C65A70]">Welcome — set up your first property</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C9C0C4]">
              As a landlord, start by adding a property (name, address, units, rent due day). Each property is independent — tenants, invoices, and payments are scoped to that property. After you add one, the “Collections by property” and “Paid vs unpaid” cards below will populate, and you can import tenants in bulk.
            </p>
            <p className="mt-2 text-xs text-[#A49DA1]">Tip: Due day 5th means invoices auto-generate at month-end for the 5th; tenants see that date.</p>
          </section>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-[#261F22] bg-[#161112] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Unmatched</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{reconciliationSummary.unmatched_count}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#1C1618] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Duplicates</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{reconciliationSummary.duplicate_count}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#161112] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Manual review</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{reconciliationSummary.manual_review_count}</p>
          </div>
          <div className="rounded-3xl border border-[#261F22] bg-[#201A1C] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#A99FA3]">Matched</p>
            <p className="mt-3 text-3xl font-bold text-[#F6F2F3]">{reconciliationSummary.matched_count}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#F6F2F3]">Collections by property</h2>
              <span className="rounded-full bg-[#2B1A1E] px-2.5 py-1 text-xs font-semibold text-[#C65A70]">{properties.length} total</span>
            </div>

            {propertySummaries.length === 0 ? (
              <p className="text-[#A49DA1]">No properties yet. Add one to get started.</p>
            ) : (
              <div className="space-y-4">
                {propertySummaries.map(({ property, totalUnits, paidCount, partialCount, overdueCount, collectedAmount, outstandingAmount, collectionRate }) => (
                  <div key={property.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#F6F2F3]">{property.name}</h3>
                        <p className="text-sm text-[#A99FA3]">{property.address}</p>
                      </div>
                      <span className="rounded-full bg-[#14211B] px-2.5 py-1 text-xs font-semibold text-[#4ADE80]">
                        {property.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#B0A8AD] md:grid-cols-4">
                      <p>Units: {totalUnits}</p>
                      <p>Paid: {paidCount}</p>
                      <p>Partial: {partialCount}</p>
                      <p>Overdue: {overdueCount}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-[#221C1E] p-3">
                        <p className="text-[#A99FA3]">Collected</p>
                        <p className="mt-1 font-semibold text-[#F6F2F3]">${collectedAmount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-[#201A1C] p-3">
                        <p className="text-[#A99FA3]">Outstanding</p>
                        <p className="mt-1 font-semibold text-[#F6F2F3]">${outstandingAmount.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#A49DA1]">
                        <span>Collection rate</span>
                        <span>{Math.round(collectionRate)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#2A2124]">
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
                        className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1 text-xs font-medium text-[#CFC5CA] hover:border-[#7A3B4C] hover:text-[#C65A70]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePropertyDelete(property.id)}
                        disabled={deletingPropertyId != null}
                        className="rounded-full border border-[#4A2127] bg-[#2E1519] px-3 py-1 text-xs font-medium text-[#F08E9B] hover:bg-[#3D1A1F] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingPropertyId === property.id ? 'Deleting…' : 'Delete'}
                      </button>
                      <span className="ml-auto text-xs text-[#A49DA1]">Due: {property.rent_due_day ?? 5}th • {property.units} units</span>
                    </div>

                    {editingPropertyId === property.id && (
                      <form onSubmit={handlePropertyUpdate} className="mt-4 space-y-3 rounded-xl border border-[#2C2326] bg-[#161112] p-4">
                        <p className="text-sm font-semibold text-[#F6F2F3]">Edit property — independent (only this property changes)</p>
                        <input
                          value={editPropertyForm.name}
                          onChange={(e) => setEditPropertyForm({ ...editPropertyForm, name: e.target.value })}
                          placeholder="Property name"
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${propertyErrors.name ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                        />
                        {propertyErrors.name && <p className="text-xs text-[#F47C8E]">{propertyErrors.name}</p>}
                        <input
                          value={editPropertyForm.address}
                          onChange={(e) => setEditPropertyForm({ ...editPropertyForm, address: e.target.value })}
                          placeholder="Address"
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${propertyErrors.address ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                        />
                        {propertyErrors.address && <p className="text-xs text-[#F47C8E]">{propertyErrors.address}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="1"
                            value={editPropertyForm.units}
                            onChange={(e) => setEditPropertyForm({ ...editPropertyForm, units: e.target.value })}
                            className={`rounded-lg border px-3 py-2 text-sm ${propertyErrors.units ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                          />
                          <select
                            value={editPropertyForm.rent_due_day}
                            onChange={(e) => setEditPropertyForm({ ...editPropertyForm, rent_due_day: e.target.value })}
                            className="rounded-lg border border-[#2A2225] px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                              <option key={d} value={d}>{d}th</option>
                            ))}
                          </select>
                        </div>
                        {propertyErrors.units && <p className="text-xs text-[#F47C8E]">{propertyErrors.units}</p>}
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading} className="no-scale flex-1 rounded-lg bg-[#7A1428] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Save</button>
                          <button type="button" onClick={() => { setEditingPropertyId(null); setPropertyErrors({}); }} className="no-scale flex-1 rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2 text-sm">Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-[#F6F2F3]">Needs attention</h2>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  {(['all', 'overdue', 'partial', 'paid'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAttentionFilter(filter)}
                      className={`rounded-full px-2.5 py-1.5 capitalize ${attentionFilter === filter ? 'bg-[#7A1428] text-white' : 'bg-[#2B1A1E] text-[#C65A70]'}`}
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
                  className="w-full rounded-xl border border-[#261F22] bg-[#1C1618] px-3 py-2.5 text-sm text-[#C9C0C4] outline-none ring-0"
                />

                <select
                  value={attentionPropertyFilter}
                  onChange={(event) => setAttentionPropertyFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                  className="w-full rounded-xl border border-[#261F22] bg-[#1C1618] px-3 py-2.5 text-sm text-[#C9C0C4] outline-none ring-0"
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
                <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-4 text-sm text-[#A49DA1]">
                  No tenants need attention right now.
                </p>
              ) : (
                attentionItems.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4 text-left transition hover:border-[#7A3B4C] hover:bg-[#221C1E]"
                  >
                    <div>
                      <p className="font-semibold text-[#F6F2F3]">{tenant.name}</p>
                      <p className="text-sm text-[#A99FA3]">
                        {tenant.propertyName} • Unit {tenant.unit_number}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tenant.status === 'overdue' ? 'bg-[#33161B] text-[#F08E9B]' : tenant.status === 'partial' ? 'bg-[#2B2116] text-[#F0B84B]' : 'bg-[#14211B] text-[#4ADE80]'}`}
                      >
                        {tenant.label}
                      </span>
                      <p className="mt-2 text-sm font-medium text-[#F6F2F3]">${Number(tenant.amountDue).toFixed(2)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#F6F2F3]">Paid vs unpaid by property</h2>
            <span className="rounded-full bg-[#2B1A1E] px-2.5 py-1 text-xs font-semibold text-[#C65A70]">{propertyPaymentStatus.length} properties</span>
          </div>

          <div className="space-y-4">
            {propertyPaymentStatus.map(({ property, paidTenants, unpaidTenants, paymentChannels }) => (
              <div key={property.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#F6F2F3]">{property.name}</h3>
                    <p className="text-sm text-[#A99FA3]">{property.address}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {paymentChannels.map((channel) => (
                      <span key={channel} className="rounded-full bg-[#2B1A1E] px-2.5 py-1 font-medium text-[#C65A70]">{channel}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-[#14211B] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#4ADE80]">Paid</p>
                    <p className="mt-2 text-lg font-bold text-[#F6F2F3]">{paidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#F6F2F3]">
                      {paidTenants.length === 0 ? (
                        <span className="text-[#A99FA3]">No tenant has paid yet</span>
                      ) : (
                        paidTenants.map((tenant) => <span key={tenant.id} className="rounded-full bg-[#161112] px-2 py-1">{tenant.name}</span>)
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#201A1C] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#D07387]">Not paid</p>
                    <p className="mt-2 text-lg font-bold text-[#F6F2F3]">{unpaidTenants.length} tenants</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#F6F2F3]">
                      {unpaidTenants.length === 0 ? (
                        <span className="text-[#A99FA3]">All tenants are fully paid</span>
                      ) : (
                        unpaidTenants.map((tenant) => <span key={tenant.id} className="rounded-full bg-[#161112] px-2 py-1">{tenant.name}</span>)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#F6F2F3]">Recent invoices</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateInvoices}
                disabled={generatingInvoices || !user}
                className="rounded-full bg-[#7A1428] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8E1A30] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingInvoices ? 'Generating…' : 'Generate next month'}
              </button>
              <span className="rounded-full bg-[#2B1A1E] px-2.5 py-1 text-xs font-semibold text-[#C65A70]">{recentInvoices.length} latest</span>
            </div>
          </div>
          {invoiceNotice && <p className="mb-3 text-sm font-medium text-[#C65A70]">{invoiceNotice}</p>}
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#2C2326]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#221C1E] text-[#B5ABB0]">
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
                    <td colSpan={4} className="px-3 py-4 text-[#A49DA1]">No invoices yet</td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-[#2A2225]">
                      <td className="px-3 py-2">{invoice.invoice_number}</td>
                      <td className="px-3 py-2">{invoice.tenant_name || '—'}</td>
                      <td className="px-3 py-2">${Number(invoice.amount).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-[#2B2116] px-2.5 py-1 text-xs font-semibold text-[#F0B84B]">{invoice.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#F6F2F3]">Payment alerts</h2>
            <span className="rounded-full bg-[#2B1A1E] px-2.5 py-1 text-xs font-semibold text-[#C65A70]">{reconciliationAlerts.length} entries</span>
          </div>
          <div className="space-y-3">
            {reconciliationAlerts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-4 text-sm text-[#A49DA1]">No reconciliation alerts.</p>
            ) : (
              reconciliationAlerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#F6F2F3]">{alert.tenant_name || alert.invoice_number || 'Unknown tenant'}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${alert.match_status === 'unmatched' ? 'bg-[#33161B] text-[#F08E9B]' : alert.match_status === 'duplicate' || alert.match_status === 'manual_review' ? 'bg-[#2B2116] text-[#F0B84B]' : 'bg-[#14211B] text-[#4ADE80]'}`}>
                      {alert.match_status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#A99FA3]">
                    {alert.property_name ? `${alert.property_name} • ` : ''}
                    {alert.invoice_number ? `Invoice ${alert.invoice_number} • ` : ''}
                    {alert.transaction_ref || 'No reference'}
                  </p>
                  <p className="mt-1 text-xs text-[#B5ABB0]">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <h2 className="text-xl font-semibold text-[#F6F2F3]">Manual payment reconciliation</h2>
          <p className="mt-2 text-sm text-[#A99FA3]">Use this when a tenant pays by bank transfer or an unmatched mobile-money reference needs to be linked to the correct tenant.</p>
          <form className="mt-4 space-y-4" onSubmit={handleManualPaymentReconciliation}>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Property</label>
              <select
                value={manualPaymentForm.property_id}
                onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, property_id: event.target.value })}
                className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Tenant name</label>
                <input
                  value={manualPaymentForm.tenant_name}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, tenant_name: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                  placeholder="Jane Mwangi"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPaymentForm.amount}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, amount: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Payment method</label>
                <select
                  value={manualPaymentForm.payment_method}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, payment_method: event.target.value as 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other' })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                >
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Transaction reference</label>
                <input
                  value={manualPaymentForm.transaction_ref}
                  onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, transaction_ref: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                  placeholder="MPESA-12345 or bank transfer ref"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Reference note</label>
              <input
                value={manualPaymentForm.reference}
                onChange={(event) => setManualPaymentForm({ ...manualPaymentForm, reference: event.target.value })}
                className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                placeholder="Jane Mwangi"
              />
            </div>

            {error && <p className="text-sm text-[#F47C8E]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Reconciling payment...' : 'Match payment to tenant'}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <h2 className="text-xl font-semibold text-[#F6F2F3]">Add property</h2>
          <form className="mt-4 space-y-4" onSubmit={handlePropertySubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Property name</label>
              <input
                value={propertyForm.name}
                onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })}
                className={`w-full rounded-lg border bg-[#161112] px-3 py-2 ${propertyErrors.name ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                placeholder="Sunset Apartments"
                aria-invalid={!!propertyErrors.name}
              />
              {propertyErrors.name && <p className="mt-1 text-xs text-[#F47C8E]">{propertyErrors.name}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Address</label>
              <input
                value={propertyForm.address}
                onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })}
                className={`w-full rounded-lg border bg-[#161112] px-3 py-2 ${propertyErrors.address ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                placeholder="12 River Road"
                aria-invalid={!!propertyErrors.address}
              />
              {propertyErrors.address && <p className="mt-1 text-xs text-[#F47C8E]">{propertyErrors.address}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Units</label>
              <input
                type="number"
                min="1"
                value={propertyForm.units}
                onChange={(event) => setPropertyForm({ ...propertyForm, units: event.target.value })}
                className={`w-full rounded-lg border bg-[#161112] px-3 py-2 ${propertyErrors.units ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                aria-invalid={!!propertyErrors.units}
              />
              {propertyErrors.units && <p className="mt-1 text-xs text-[#F47C8E]">{propertyErrors.units}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Rent due day (landlord dictates)</label>
              <select
                value={propertyForm.rent_due_day}
                onChange={(event) => setPropertyForm({ ...propertyForm, rent_due_day: event.target.value })}
                className={`w-full rounded-lg border bg-[#161112] px-3 py-2 ${propertyErrors.rent_due_day ? 'border-[#5C2730]' : 'border-[#2A2225]'}`}
                aria-invalid={!!propertyErrors.rent_due_day}
              >
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                  <option key={d} value={d}>{d}th of each month</option>
                ))}
              </select>
              {propertyErrors.rent_due_day && <p className="mt-1 text-xs text-[#F47C8E]">{propertyErrors.rent_due_day}</p>}
              <p className="mt-1 text-xs text-[#A49DA1]">Tenants know this day; invoices auto-generate at month-end for next due date (no manual Create invoice).</p>
            </div>

            {error && <p className="text-sm text-[#F47C8E]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save property'}
            </button>
          </form>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#F6F2F3]">Payment Channels (PayHero)</h2>
              <button type="button" onClick={loadPaymentChannels} className="rounded-full bg-[#2B1A1E] px-3 py-1.5 text-xs font-semibold text-[#C65A70]">Refresh</button>
            </div>

            {walletBalance && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${walletBalance.low ? 'border-[#4A2127] bg-[#2E1519] text-[#F0A0AB]' : 'border-[#2C2326] bg-[#2B1A1E]/50 text-[#D07387]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">PayHero service wallet balance</span>
                  <span className="font-semibold">{walletBalance.currency} {walletBalance.available_balance.toLocaleString()}</span>
                </div>
                {walletBalance.low
                  ? <p className="mt-1 text-xs font-medium">Low balance — PayHero uses a prepaid wallet; a depleted wallet silently blocks new transactions. Top it up in the PayHero portal.</p>
                  : <p className="mt-1 text-xs text-[#8C8287]">Prepaid wallet threshold for warning: {walletBalance.currency} {walletBalance.threshold.toLocaleString()}.</p>}
              </div>
            )}

            <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={handlePaymentChannelSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Channel type</label>
                <select value={paymentChannelForm.channel_type} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, channel_type: event.target.value as 'paybill' | 'till' | 'bank' | 'send_money' })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2">
                  <option value="paybill">Paybill</option>
                  <option value="till">Till</option>
                  <option value="bank">Bank</option>
                  <option value="send_money">Send Money (phone number)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">
                  {paymentChannelForm.channel_type === 'send_money'
                    ? 'Your receiving phone number'
                    : 'Short code / Paybill / Till / Bank number'}
                </label>
                <input
                  value={paymentChannelForm.short_code}
                  onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, short_code: event.target.value })}
                  placeholder={paymentChannelForm.channel_type === 'send_money' ? 'e.g. 0712345678' : 'e.g. 522522'}
                  inputMode={paymentChannelForm.channel_type === 'send_money' ? 'tel' : 'text'}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                />
                {paymentChannelForm.channel_type === 'send_money' && (
                  <p className="mt-1 text-xs text-[#8A7F83]">
                    Tenants can send rent straight to this number. We use it to match incoming Send Money payments to your account.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Account number (bank / paybill account — optional)</label>
                <input value={paymentChannelForm.account_number} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, account_number: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Description</label>
                <input value={paymentChannelForm.description} onChange={(event) => setPaymentChannelForm({ ...paymentChannelForm, description: event.target.value })} placeholder="e.g. Main Paybill" className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={paymentChannelLoading || !paymentChannelForm.short_code.trim()} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60">
                  {paymentChannelLoading
                    ? paymentChannelForm.channel_type === 'send_money' ? 'Saving...' : 'Registering with PayHero...'
                    : 'Add payment channel'}
                </button>
                {paymentChannelError && <p className="mt-2 text-xs text-[#F47C8E]">{paymentChannelError}</p>}
              </div>
            </form>

            {paymentChannels.length === 0 ? (
              <p className="mt-4 text-sm text-[#A49DA1]">No payment channels yet. Add a Paybill, Till, or Bank channel — PayHero requires an ownership-confirmation step before incoming payments activate. You can also add a Send Money number to receive rent straight to your phone.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {paymentChannels.map((channel) => (
                  <li key={channel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2A2225] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#F6F2F3]">{channel.description || channel.short_code}</span>
                        <span className="rounded-full bg-[#2B1A1E] px-2 py-0.5 text-xs font-semibold text-[#C65A70] uppercase">{channel.channel_type}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${channel.verification_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-[#2B2116] text-[#F2C060]'}`}>{channel.verification_status}</span>
                        {!channel.is_active && <span className="rounded-full bg-[#2A2225] px-2 py-0.5 text-xs font-semibold text-[#B0A8AD]">deactivated</span>}
                      </div>
                      <p className="mt-1 truncate text-xs text-[#A49DA1]">
                        {channel.channel_type === 'send_money' ? 'Receiving number' : 'Short code'}: {channel.short_code}
                        {channel.channel_type === 'send_money'
                          ? ' · matched on incoming Send Money payments'
                          : channel.payhero_channel_id
                            ? ` · PayHero channel id: ${channel.payhero_channel_id}`
                            : ' · not yet confirmed by PayHero'}
                        {channel.account_number ? ` · Acct: ${channel.account_number}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {channel.channel_type !== 'send_money' && (
                        <button type="button" onClick={() => handlePaymentChannelSync(channel.id)} className="rounded-full border border-[#2C2326] px-3 py-1 text-xs font-semibold text-[#D07387]">Sync status</button>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePaymentChannelToggle(channel)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${channel.is_active ? 'bg-[#7A1428] text-white' : 'bg-[#2B1A1E] text-[#C65A70]'}`}
                      >
                        {channel.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
            <h2 className="text-xl font-semibold text-[#F6F2F3]">Add tenant</h2>
            <form className="mt-4 space-y-4" onSubmit={handleTenantSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Property</label>
                <select
                  value={tenantForm.property_id}
                  onChange={(event) => setTenantForm({ ...tenantForm, property_id: event.target.value })}
                  className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Name</label>
                <input value={tenantForm.name} onChange={(event) => setTenantForm({ ...tenantForm, name: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Phone</label>
                <input value={tenantForm.phone} onChange={(event) => setTenantForm({ ...tenantForm, phone: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Unit</label>
                  <input value={tenantForm.unit_number} onChange={(event) => setTenantForm({ ...tenantForm, unit_number: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Rent</label>
                  <input type="number" value={tenantForm.monthly_rent} onChange={(event) => setTenantForm({ ...tenantForm, monthly_rent: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#8E1A30] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Saving...' : 'Add tenant'}</button>
            </form>
          </section>

        </div>

        <div className="mt-8">
          <BulkTenantImport properties={properties} tenants={tenants} onImported={handleTenantsImported} />
        </div>

        {selectedTenant && selectedTenantSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl border border-[#261F22] bg-[#161112] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C65A70]">Tenant details</p>
                  <h3 className="mt-2 text-2xl font-bold text-[#F6F2F3]">{selectedTenant.name}</h3>
                  <p className="text-sm text-[#A99FA3]">
                    {properties.find((property) => property.id === selectedTenant.property_id)?.name ?? 'Unknown property'} • Unit {selectedTenant.unit_number}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTenantId(null)}
                  className="rounded-full border border-[#33282C] bg-[#201A1C] px-3 py-1.5 text-sm font-medium text-[#CFC5CA]"
                >
                  Close
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Status</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">{selectedTenantSummary.label}</p>
                </div>
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Total due</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">${Number(selectedTenantSummary.amountDue).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-[#221C1E] p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#B5ABB0]">Monthly rent</p>
                  <p className="mt-2 text-lg font-semibold text-[#F6F2F3]">${Number(selectedTenant.monthly_rent).toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'moved_out')}
                  disabled={loading}
                  className="rounded-xl border border-[#4A3339] bg-[#1C1618] px-3 py-2 text-sm font-medium text-[#C65A70] disabled:opacity-60"
                >
                  Mark moved out
                </button>
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'archived')}
                  disabled={loading}
                  className="rounded-xl border border-[#4A3339] bg-[#161112] px-3 py-2 text-sm font-medium text-[#CFC5CA] disabled:opacity-60"
                >
                  Archive tenant
                </button>
                <button
                  type="button"
                  onClick={() => handleTenantLifecycleAction(selectedTenant.id, 'delete')}
                  disabled={loading}
                  className="rounded-xl border border-[#4A2127] bg-[#2E1519] px-3 py-2 text-sm font-medium text-[#F08E9B] disabled:opacity-60"
                >
                  Delete tenant
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Invoices</h4>
                  <div className="space-y-3">
                    {selectedTenantInvoices.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-3 text-sm text-[#A49DA1]">No invoices yet.</p>
                    ) : (
                      selectedTenantInvoices.map((invoice) => {
                        const invoicePayments = payments.filter((payment) => payment.invoice_id === invoice.id);
                        const invoicePaid = invoicePayments
                          .filter((payment) => payment.status === 'completed')
                          .reduce((sum, payment) => sum + Number(payment.amount), 0);

                        return (
                          <div key={invoice.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-[#F6F2F3]">{invoice.invoice_number}</p>
                              <span className="rounded-full bg-[#2B1A1E] px-2 py-1 text-[11px] font-semibold text-[#C65A70] uppercase">
                                {invoice.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#A99FA3]">Due: {invoice.due_date}</p>
                            <p className="text-sm text-[#A99FA3]">Amount: ${Number(invoice.amount).toFixed(2)}</p>
                            <p className="text-sm text-[#A99FA3]">Paid: ${invoicePaid.toFixed(2)}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Payment history</h4>
                  <div className="space-y-3">
                    {selectedTenantPayments.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-3 text-sm text-[#A49DA1]">No payments recorded.</p>
                    ) : (
                      selectedTenantPayments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-[#2C2326] bg-[#1C1618] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-[#F6F2F3]">${Number(payment.amount).toFixed(2)}</p>
                            <span className="rounded-full bg-[#14211B] px-2 py-1 text-[11px] font-semibold text-[#4ADE80] uppercase">
                              {payment.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#A99FA3]">Method: {payment.payment_method}</p>
                          <p className="text-sm text-[#A99FA3]">Reference: {payment.reference || '—'}</p>
                          <p className="text-sm text-[#A99FA3]">Paid: {payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '—'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#F6F2F3]">Reports</h2>
              <p className="mt-1 text-sm text-[#A99FA3]">Arrears by property, monthly collection rate, and per-tenant statements — exportable as CSV.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reportPropertyFilter}
                onChange={(event) => {
                  const next = event.target.value === 'all' ? 'all' : Number(event.target.value);
                  setReportPropertyFilter(next);
                  setReportsError('');
                  getArrears(next === 'all' ? undefined : next)
                    .then(setArrears)
                    .catch((err: unknown) => setReportsError(err instanceof Error ? err.message : 'Failed to load arrears'));
                }}
                className="rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-1.5 text-sm"
              >
                <option value="all">All properties</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadReports}
                disabled={reportsLoading}
                className="rounded-full bg-[#2B1A1E] px-3 py-1.5 text-xs font-semibold text-[#C65A70] disabled:opacity-60"
              >
                {reportsLoading ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => downloadArrearsCsv(reportPropertyFilter === 'all' ? undefined : reportPropertyFilter)}
                className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-semibold text-[#D07387] hover:border-[#7A3B4C]"
              >
                Arrears CSV
              </button>
              <button
                type="button"
                onClick={() => downloadCollectionRateCsv()}
                className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-semibold text-[#D07387] hover:border-[#7A3B4C]"
              >
                Collection CSV
              </button>
            </div>
          </div>

          {reportsError && <p className="mb-3 text-sm text-[#F47C8E]">{reportsError}</p>}

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Arrears by property</h3>
              {arrears.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-4 text-sm text-[#A49DA1]">
                  No arrears data. Generate invoices and let payments reconcile to see totals.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#2C2326]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#221C1E] text-[#B5ABB0]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Property</th>
                        <th className="px-3 py-2 font-medium">Invoiced</th>
                        <th className="px-3 py-2 font-medium">Paid</th>
                        <th className="px-3 py-2 font-medium">Outstanding</th>
                        <th className="px-3 py-2 font-medium">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrears.map((row) => (
                        <tr key={row.property_id} className="border-t border-[#2A2225]">
                          <td className="px-3 py-2 font-medium text-[#F6F2F3]">{row.property_name}</td>
                          <td className="px-3 py-2">${Number(row.total_invoiced).toFixed(2)}</td>
                          <td className="px-3 py-2">${Number(row.total_paid).toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold text-[#C65A70]">${Number(row.outstanding).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.overdue_count > 0 ? 'bg-[#33161B] text-[#F08E9B]' : 'bg-[#14211B] text-[#4ADE80]'}`}>
                              {row.overdue_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-[#F6F2F3]">Collection rate (12 months)</h3>
              {collectionRate.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#3A2E32] bg-[#1C1618] p-4 text-sm text-[#A49DA1]">No monthly collection data yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#2C2326]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#221C1E] text-[#B5ABB0]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">Invoiced</th>
                        <th className="px-3 py-2 font-medium">Collected</th>
                        <th className="px-3 py-2 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...collectionRate].reverse().map((row) => (
                        <tr key={row.month} className="border-t border-[#2A2225]">
                          <td className="px-3 py-2 font-medium text-[#F6F2F3]">{row.month}</td>
                          <td className="px-3 py-2">${Number(row.invoiced).toFixed(2)}</td>
                          <td className="px-3 py-2">${Number(row.collected).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${Number(row.collection_rate_pct) >= 90 ? 'bg-[#14211B] text-[#4ADE80]' : Number(row.collection_rate_pct) >= 70 ? 'bg-[#2B2116] text-[#F0B84B]' : 'bg-[#33161B] text-[#F08E9B]'}`}>
                              {Number(row.collection_rate_pct).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#2C2326] bg-[#1C1618] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h3 className="text-lg font-semibold text-[#F6F2F3]">Tenant statement</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={reportStatementTenantId}
                  onChange={(event) => {
                    setReportStatementTenantId(event.target.value === '' ? '' : Number(event.target.value));
                    setTenantStatement(null);
                  }}
                  className="rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-1.5 text-sm"
                >
                  <option value="">Select tenant</option>
                  {properties.map((property) => (
                    <optgroup key={property.id} label={property.name}>
                      {tenants.filter((tenant) => tenant.property_id === property.id).map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.name} — {tenant.unit_number}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleTenantStatementLoad}
                  disabled={reportStatementTenantId === ''}
                  className="rounded-full bg-[#7A1428] px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  View statement
                </button>
                {tenantStatement && (
                  <button
                    type="button"
                    onClick={() => downloadTenantStatementCsv(tenantStatement.tenant.id, tenantStatement.tenant.name)}
                    className="rounded-full border border-[#33282C] bg-[#161112] px-3 py-1.5 text-xs font-semibold text-[#D07387] hover:border-[#7A3B4C]"
                  >
                    Statement CSV
                  </button>
                )}
              </div>
            </div>

            {tenantStatement ? (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-[#2C2326] bg-[#161112]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#221C1E] text-[#B5ABB0]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Reference</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantStatement.statement.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-4 text-[#A49DA1]">No activity for this tenant yet.</td></tr>
                    ) : (
                      tenantStatement.statement.map((entry, index) => (
                        <tr key={`${entry.ref_number}-${index}`} className={`border-t border-[#2A2225] ${entry.type === 'invoice' ? 'bg-[#201A1C]' : ''}`}>
                          <td className="px-3 py-2 capitalize">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.type === 'invoice' ? 'bg-[#2B1A1E] text-[#C65A70]' : 'bg-[#14211B] text-[#4ADE80]'}`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">{entry.ref_number}</td>
                          <td className="px-3 py-2">{new Date(entry.occurred_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2">{Number(entry.amount) > 0 ? '+' : ''}${Number(entry.amount).toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold text-[#F6F2F3]">${Number(entry.running_balance).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#A49DA1]">Select a tenant to view their full invoice + payment history with running balance.</p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#2C2326] bg-[#161112] p-6 shadow-[0_12px_26px_rgba(0,0,0,0.4)]">
          <h2 className="text-xl font-semibold text-[#F6F2F3]">Maintenance</h2>
          <form className="mt-4 grid gap-4 lg:grid-cols-2" onSubmit={handleMaintenanceSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Property</label>
              <select value={maintenanceForm.property_id} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, property_id: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2">
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Tenant</label>
              <select value={maintenanceForm.tenant_id} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, tenant_id: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2">
                <option value="">Optional tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Title</label>
              <input value={maintenanceForm.title} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, title: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Priority</label>
              <select value={maintenanceForm.priority} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, priority: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Description</label>
              <textarea value={maintenanceForm.description} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2" />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[#C9C0C4]">Status</label>
              <select value={maintenanceForm.status} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, status: event.target.value })} className="w-full rounded-lg border border-[#2A2225] bg-[#161112] px-3 py-2">
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#7A1428] px-4 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Saving...' : 'Create maintenance request'}</button>
            </div>
          </form>

          {/* Landlord action queue + escalation */}
          {maintenanceActionQueue.length > 0 && (
            <div className="mt-6 rounded-2xl border border-[#4A3820] bg-[#2B2116] p-4">
              <h3 className="text-sm font-semibold text-[#F2C060]">Landlord action queue — {maintenanceActionQueue.length} open</h3>
              <p className="mt-1 text-xs text-[#F0B84B]">Filtered by your properties only (owner_id isolation). Urgent first, then by age.</p>
              {escalatedUrgent.length > 0 && (
                <p className="mt-2 rounded-lg bg-[#2E1519] px-3 py-2 text-xs font-semibold text-[#F08E9B]">⚠ {escalatedUrgent.length} urgent repair(s) older than 48h — escalated</p>
              )}
              <div className="mt-3 space-y-2">
                {maintenanceActionQueue.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#161112] px-3 py-2 text-sm">
                    <span><span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${item.priority === 'urgent' ? 'bg-[#33161B] text-[#F08E9B]' : item.priority === 'high' ? 'bg-[#2B2116] text-[#F0B84B]' : 'bg-[#221C1E] text-[#B0A8AD]'}`}>{item.priority}</span> {item.title} • {item.property_name}</span>
                    <span className="text-xs text-[#A49DA1]">{new Date(item.created_at).toLocaleDateString()}</span>
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
                  <div key={item.id} className={`rounded-xl border p-4 ${isEscalated ? 'border-[#4A2127] bg-[#2E1519]' : 'border-[#2A2225] bg-[#161112]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{item.title} {isEscalated && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">Escalated</span>}</h3>
                        <p className="text-sm text-[#A49DA1]">{item.property_name || 'Property'} • {item.tenant_name || 'No tenant'} — isolated to your properties</p>
                      </div>
                      <span className="rounded-full bg-[#2B2116] px-2.5 py-1 text-xs font-semibold text-[#F0B84B]">{item.priority}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#B0A8AD]">{item.description}</p>
                    <p className="mt-1 text-xs text-[#A49DA1]">Status: <span className="font-medium text-ink">{item.status}</span> • Created {new Date(item.created_at).toLocaleString()}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === 'open' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'in_progress')} className="rounded-full bg-[#7A1428] px-3 py-1 text-xs font-semibold text-white">Start → In progress</button>}
                      {item.status === 'in_progress' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'resolved')} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Resolve</button>}
                      {item.status === 'resolved' && <button type="button" onClick={() => handleMaintenanceStatusChange(item.id, 'closed')} className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">Close</button>}
                      {item.priority !== 'urgent' && item.status !== 'closed' && item.status !== 'resolved' && <button type="button" onClick={() => handleMaintenanceEscalate(item.id)} className="rounded-full border border-[#4A2127] bg-[#161112] px-3 py-1 text-xs font-semibold text-[#F08E9B]">Escalate to urgent</button>}
                      <button type="button" onClick={() => handleMaintenanceDelete(item.id)} className="rounded-full border border-[#2A2225] bg-[#161112] px-3 py-1 text-xs text-[#B0A8AD]">Delete</button>
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
