import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { googleLogin, login, logout, register, type AuthUser } from './lib/api/auth';
import { getBilling, type Entitlement, type Feature } from './lib/api/billing';
import { getApiHealth } from './lib/api/client';
import { createProperty, getProperties, updateProperty, deleteProperty, type Property } from './lib/api/properties';
import { kes } from './lib/format';
import { createTenant, deleteTenant, getTenants, updateTenantStatus, type Tenant } from './lib/api/tenants';
import { getInvoices, generateInvoices, type Invoice } from './lib/api/invoices';
import { getPayments, createPayment, type Payment } from './lib/api/payments';
import { createMaintenanceRequest, getMaintenanceRequests, updateMaintenanceRequest, deleteMaintenanceRequest, type MaintenanceRequest } from './lib/api/maintenance';
import { createPaymentChannel, deletePaymentChannel, getPaymentChannels, syncPaymentChannel, updatePaymentChannel, type PaymentChannel } from './lib/api/channels';
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
import { type SetupStep } from './components/SetupChecklist';
import Paywall from './components/Paywall';
import {
  DashboardContext,
  readPageFromHash,
  type DashboardValue,
  type ModalId,
  type PageId,
} from './dashboard/context';
import { AppShell } from './dashboard/shell';

type Mode = 'login' | 'register';

export default function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [gsiReady, setGsiReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  // null = not checked yet. Kept distinct from 'active' so a brief flash of the paywall during
  // sign-in does not happen, and so a billing outage does not lock a paying customer out.
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  // What this account's plan entitles it to, as resolved by the server from the published tier list.
  // Three states, because "we do not know yet" and "billing is down" call for opposite behaviour:
  //   undefined - not asked yet. Gated sections stay hidden so they do not flash into view and then
  //               disappear for a Basic landlord as the answer arrives.
  //   Entitlement - answered. Gated sections are rendered from this list.
  //   null - billing could not be reached at all. Everything is shown, because hiding paid features
  //          during our own outage would be worse than briefly showing a section the API will refuse.
  const [entitlement, setEntitlement] = useState<Entitlement | null | undefined>(undefined);
  const [properties, setProperties] = useState<Property[]>([]);
  // Which property's units are open in the PropertyUnits panel. App owns it because the Units
  // button on a property card is what sets it.
  const [selectedPropertyForUnits, setSelectedPropertyForUnits] = useState<number | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // True from the moment the app mounts until the first dashboard payload lands. `loading` only
  // ever tracks form submissions, so without this the cards would have nothing to key a skeleton
  // off and would flash empty states on every cold start.
  const [dataLoading, setDataLoading] = useState(true);
  // Confirmation for a payment the landlord recorded by hand. Not an STK prompt notice - Rent Sync
  // does not prompt tenants.
  const [recordPaymentNotice, setRecordPaymentNotice] = useState('');

  // Manual payment capture. Most rent in Kenya arrives as M-Pesa Send Money straight into the
  // landlord's own number, which no payment provider can see and therefore never calls us about.
  // This is the only way that money reaches the ledger, so it is a first-class flow and not a
  // fallback hidden behind a menu.
  const [recordingInvoiceId, setRecordingInvoiceId] = useState<number | null>(null);
  const [recordingTenantId, setRecordingTenantId] = useState<number | null>(null);
  const [recordAmount, setRecordAmount] = useState('');
  const [recordMethod, setRecordMethod] = useState<'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'other'>('mobile_money');
  const [recordReference, setRecordReference] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [recordError, setRecordError] = useState('');
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
    // Deliberately blank rather than '1': the declared unit count is what the plan cap measures and
    // what the Units panel materialises rows from, so a landlord who forgets to change a pre-filled
    // "1" declares their whole block as a single flat. validatePropertyForm already rejects blank.
    units: '',
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
  const [paymentChannelForm, setPaymentChannelForm] = useState({ channel_type: 'paybill' as 'paybill' | 'till' | 'bank', short_code: '', account_number: '', description: '' });
  const [paymentChannelError, setPaymentChannelError] = useState('');
  const [paymentChannelLoading, setPaymentChannelLoading] = useState(false);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [collectionRate, setCollectionRate] = useState<CollectionRateRow[]>([]);
  const [reportPropertyFilter, setReportPropertyFilter] = useState<'all' | number>('all');
  const [reportStatementTenantId, setReportStatementTenantId] = useState<number | ''>('');
  const [tenantStatement, setTenantStatement] = useState<TenantStatement | null>(null);
  const [tenantRosterSearch, setTenantRosterSearch] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

  // Which page of the portal is showing, and which create-form drawer is open. Both live here (not
  // in the shell) because the setup checklist and the Collect action navigate and open forms, and
  // the create handlers close their drawer the moment the save succeeds.
  const [page, setPage] = useState<PageId>(readPageFromHash);
  const [modal, setModal] = useState<ModalId | null>(null);

  // The active page is mirrored in the hash so refresh, bookmark and back/forward all work.
  useEffect(() => {
    const syncFromHash = () => setPage(readPageFromHash());
    window.addEventListener('hashchange', syncFromHash);
    if (!window.location.hash) window.location.replace('#/overview');
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const isLoggedIn = Boolean(localStorage.getItem('property_app_token'));

  // The single source of truth for what this dashboard may render. The API refuses a gated request
  // with 402 whatever this returns, so being generous here only ever risks a section that fails to
  // load - it can never expose a feature the plan does not include.
  const can = (feature: Feature) => {
    if (entitlement === null) return true; // billing unreachable: fail open rather than lock out
    return entitlement?.features.includes(feature) ?? false;
  };

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

    if (!isLoggedIn) return;

    // Check the subscription BEFORE loading dashboard data. Every product endpoint answers 402 for
    // an unpaid account, so loading first would fire eight requests that all fail and surface eight
    // errors on a screen the user is about to be replaced from.
    getBilling()
      .then((state) => {
        setSubscriptionStatus(state.subscription.status);
        setEntitlement(state.entitlement);
        if (state.subscription.status === 'active') {
          // The entitlement is passed in rather than read back off state: setEntitlement has not
          // flushed yet inside this callback, so reading it here would still see the previous value
          // and fire requests the plan does not allow.
          loadProperties(false, state.entitlement).finally(() => setDataLoading(false));
          loadPaymentChannels();
          getArrears().then(setArrears).catch(() => setArrears([]));
          if (state.entitlement.features.includes('collectionRate')) {
            getCollectionRate().then(setCollectionRate).catch(() => undefined);
          }
        }
      })
      // A failure here is deliberately swallowed. If billing is unreachable we leave the status null
      // and let the dashboard render: failing closed here would take a paying customer offline
      // because of our own outage, which is worse than briefly showing someone paid-for features.
      .catch(() => {
        setSubscriptionStatus('active');
        setEntitlement(null);
        // Billing is down, so no dashboard request fires here; the Refresh button is the way back.
        // Stop the skeletons regardless, or every card spins forever on an outage.
        setDataLoading(false);
      });
  }, [isLoggedIn]);

  // Payments arrive by webhook, so a dashboard that only loads on mount shows a landlord a stale page
  // while they are standing there waiting for a tenant's money to land. Poll quietly so a payment
  // appears on its own; the Refresh button and "Updated" stamp make the timing visible rather than magic.
  // Billing is re-read on the same beat, so a plan upgraded mid-session brings its sections back
  // without the landlord having to reload to find out they paid for something.
  //
  // Only the slices that can change without the landlord touching anything are re-read: billing,
  // invoices and payments. Properties, tenants, maintenance and reconciliation alerts only change
  // through the UI, so the mount load and the Refresh button already cover them.
  //
  // This used to re-run the full seven-endpoint loadProperties() every tick — eight requests every
  // thirty seconds, which is more than the old 100-per-15-minutes limit allowed per IP. A paying
  // landlord therefore throttled their own dashboard about a minute after logging in, and because the
  // errors were swallowed with .catch(() => undefined) the page just quietly stopped updating. Three
  // reads per tick plus a backoff keeps polling a background detail instead of the app's main event.
  useEffect(() => {
    if (!isLoggedIn) return;
    if (subscriptionStatus !== 'active') return;

    const BASE_MS = 30_000;
    const MAX_MS = 5 * 60_000;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const [billingRes, invoiceRes, paymentRes] = await Promise.allSettled([
          getBilling(),
          getInvoices(),
          getPayments(),
        ]);
        if (cancelled) return;

        // A rejected billing read must not clear entitlement, or one flaky request would strip
        // every paid section off the dashboard.
        if (billingRes.status === 'fulfilled') setEntitlement(billingRes.value.entitlement);
        if (invoiceRes.status === 'fulfilled') setInvoices(invoiceRes.value);
        if (paymentRes.status === 'fulfilled') setPayments(paymentRes.value);

        // Partial success still means we reached the server, so one flaky endpoint should not push
        // the whole poll into a five-minute backoff.
        const reached = [billingRes, invoiceRes, paymentRes].some((r) => r.status === 'fulfilled');
        if (reached) {
          if (failures > 0) console.info('Dashboard polling recovered');
          failures = 0;
          setLastUpdated(new Date());
        } else {
          failures += 1;
        }
      } catch (err) {
        failures += 1;
        if (!cancelled) console.warn('Dashboard poll failed', err);
      }

      if (cancelled) return;
      // Back off while the backend is unhealthy or throttling us, so the client waiting on it is not
      // also the thing keeping it down.
      const delay = failures === 0 ? BASE_MS : Math.min(BASE_MS * 2 ** failures, MAX_MS);
      timer = setTimeout(poll, delay);
    };

    timer = setTimeout(poll, BASE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLoggedIn, subscriptionStatus]);

  async function loadProperties(silent = false, known?: Entitlement | null) {
    // Called with the freshly-fetched entitlement on the billing path, and with nothing on the poll
    // and refresh paths, where state is already current.
    const granted = known === undefined ? entitlement : known;
    const allowed = (feature: Feature) =>
      granted === null ? true : (granted?.features.includes(feature) ?? false);

    try {
      const [propRes, tenantRes, invoiceRes, paymentRes, maintRes, alertsRes, summaryRes] = await Promise.allSettled([
        getProperties(),
        getTenants(),
        getInvoices(),
        getPayments(),
        // Gated lists are not even requested. Firing them anyway would answer 402 seven times over
        // and fill the console with stack traces for sections this plan cannot open.
        allowed('maintenance') ? getMaintenanceRequests() : Promise.resolve([] as MaintenanceRequest[]),
        allowed('reconciliation') ? getReconciliationAlerts() : Promise.resolve([] as ReconciliationAlert[]),
        allowed('reconciliation') ? getReconciliationSummary() : Promise.resolve({ unmatched_count: 0, duplicate_count: 0, manual_review_count: 0, matched_count: 0 }),
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

  // Money still owed on an invoice. Computed from completed payments only, so a pending or failed
  // row never makes an invoice look settled.
  function outstandingFor(invoice: Invoice) {
    const paid = payments
      .filter((payment) => payment.invoice_id === invoice.id && payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    return Number(invoice.amount) - paid;
  }

  // The invoice a landlord most likely wants to collect against: the oldest one that still owes
  // money. Oldest first because that is the arrears they are chasing.
  function nextInvoiceToCollect() {
    return (
      invoices
        .filter(
          (invoice) =>
            invoice.status !== 'paid' &&
            invoice.status !== 'cancelled' &&
            outstandingFor(invoice) > 0.005
        )
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] ?? null
    );
  }

  // Opens a tenant, optionally with the record-payment form already open on a given invoice. This
  // is what makes "Collect" a single action instead of scroll-to-list, click-tenant, find-invoice,
  // click-record.
  function openTenant(tenantId: number, recordInvoiceId?: number) {
    setSelectedTenantId(tenantId);
    if (recordInvoiceId === undefined) return;
    const invoice = invoices.find((candidate) => candidate.id === recordInvoiceId);
    if (invoice) openRecordPayment(invoice, tenantId, outstandingFor(invoice));
  }

  // Setup and Collect used to smooth-scroll to a section further down the same page. With one page
  // at a time, the equivalent is switching to the page that holds the thing (and opening the form
  // the landlord was being sent to) - the intent, "put them in front of it", is unchanged.
  function goTo(pageId: PageId, open: ModalId | null = null) {
    setPage(pageId);
    setModal(open);
    const hash = `#/${pageId}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }

  // The one action behind the checklist's "Collect" step and the header's Collect button.
  function startCollecting() {
    const invoice = nextInvoiceToCollect();
    if (invoice && invoice.tenant_id !== null) {
      openTenant(invoice.tenant_id, invoice.id);
      return;
    }
    // Nothing outstanding: point them at the place that would create something to collect.
    goTo('invoices');
  }

  function handleSetupAction(step: SetupStep) {
    switch (step) {
      case 'property':
        goTo('properties', 'add-property');
        break;
      case 'tenant':
        goTo('tenants', 'add-tenant');
        break;
      case 'invoice':
        // Only offer the button when there is something to bill, otherwise generateMonthlyInvoices
        // finds no candidates and the landlord gets a confusing "0 created".
        if (tenants.some((tenant) => tenant.status === 'active')) {
          void handleGenerateInvoices();
        } else {
          goTo('tenants', 'add-tenant');
        }
        break;
      case 'collect':
        startCollecting();
        break;
      case 'channel':
        goTo('channels', 'add-channel');
        break;
      default:
        goTo('channels', 'add-channel');
    }
  }

  function openRecordPayment(invoice: Invoice, tenantId: number, outstanding: number) {
    setRecordingInvoiceId(invoice.id);
    setRecordingTenantId(tenantId);
    setRecordAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
    setRecordMethod('mobile_money');
    setRecordReference('');
    setRecordError('');
  }

  function closeRecordPayment() {
    setRecordingInvoiceId(null);
    setRecordingTenantId(null);
    setRecordError('');
  }

  async function handleSaveRecordedPayment(event: FormEvent, invoice: Invoice) {
    event.preventDefault();
    if (recordingTenantId === null) return;

    const amount = Number(recordAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRecordError('Enter the amount you received.');
      return;
    }

    const paidSoFar = payments
      .filter((payment) => payment.invoice_id === invoice.id && payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = outstandingFor(invoice);

    // Refuse to overfill the invoice. A mistyped digit here would silently mark rent paid that never
    // arrived, which is the one mistake a rent ledger cannot recover from.
    if (amount > outstanding) {
      setRecordError(
        `That is more than the ${kes(outstanding)} still outstanding on ${invoice.invoice_number}. ` +
          `Split the difference across invoices instead of overfilling this one.`
      );
      return;
    }

    setSavingPayment(true);
    setRecordError('');
    try {
      await createPayment({
        invoice_id: invoice.id,
        tenant_id: recordingTenantId,
        amount,
        payment_method: recordMethod,
        reference: recordReference.trim() || undefined,
        status: 'completed',
      });
      // Reload so the invoice status, the KPIs and the payments list all reflect the new row.
      await loadProperties(true);
      setLastUpdated(new Date());
      setRecordPaymentNotice(
        `Recorded ${kes(amount)} against ${invoice.invoice_number}. The invoice is now ` +
          `${amount + paidSoFar >= Number(invoice.amount) ? 'paid in full' : 'part paid'}.`
      );
      closeRecordPayment();
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Could not save the payment');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadProperties(true);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
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

      setPropertyForm({ name: '', address: '', units: '', rent_due_day: '5' });
      setPropertyErrors({});
      setModal(null);
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

  // Returns the promise rather than being async: the callers that await this need the fetch to have
  // actually finished before they read the channel list back.
  function loadPaymentChannels() {
    // The shared PayHero service wallet is deliberately NOT fetched for landlords. It is one
    // platform-wide prepaid balance, not the landlord's money, and since Rent Sync does not prompt
    // tenants, nothing a landlord does in this product can move it. Surfacing it only ever
    // confused landlords and leaked a shared business figure.
    return getPaymentChannels()
      .then(setPaymentChannels)
      .catch((reason) => console.warn('payment channels failed', reason));
  }

  async function loadReports() {
    setReportsLoading(true);
    setReportsError('');
    try {
      // Arrears are on every plan; the collection-rate trend is a Standard-and-up feature. A Basic
      // landlord still gets their arrears table, just not the trend or its download.
      const [arrearsRes, rateRes] = await Promise.allSettled([
        getArrears(reportPropertyFilter === 'all' ? undefined : reportPropertyFilter),
        can('collectionRate') ? getCollectionRate() : Promise.resolve(null),
      ]);
      if (arrearsRes.status === 'fulfilled') setArrears(arrearsRes.value);
      else if (reportPropertyFilter === 'all') setArrears([]);
      if (arrearsRes.status === 'rejected') console.warn('arrears failed', arrearsRes.reason);
      if (rateRes.status === 'fulfilled' && rateRes.value) setCollectionRate(rateRes.value);
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
    if (!can('tenantStatements')) return;
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
      setModal(null);
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

  async function handlePaymentChannelDelete(channel: PaymentChannel) {
    const label = channel.description || channel.short_code;
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setPaymentChannelError('');
    try {
      await deletePaymentChannel(channel.id);
      await loadPaymentChannels();
    } catch (err) {
      // A channel with payments against it comes back as 409 with the server's own wording, which
      // is more specific than anything this screen could say - so it is shown as-is.
      setPaymentChannelError(err instanceof Error ? err.message : 'Failed to delete payment channel');
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
      setModal(null);
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
      setModal(null);
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

  // Every tenant, every status, across every property - the roster is the landlord's own record of
  // who lives where, so someone who moved out stays findable rather than disappearing the moment
  // their status changes (the sections that drive money still filter to active; see activeTenants).
  // Ordered by building then unit, with unit numbers compared as numbers so "2" does not sort after
  // "10", because that is the order a landlord walks the block in.
  const tenantRoster = useMemo(() => {
    const needle = tenantRosterSearch.trim().toLowerCase();
    return tenants
      .filter(
        (t) =>
          !needle ||
          t.name.toLowerCase().includes(needle) ||
          (t.property_name ?? '').toLowerCase().includes(needle) ||
          t.unit_number.toLowerCase().includes(needle) ||
          (t.phone ?? '').toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          (a.property_name ?? '').localeCompare(b.property_name ?? '') ||
          a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }) ||
          a.name.localeCompare(b.name)
      );
  }, [tenants, tenantRosterSearch]);

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
      <div className="min-h-screen bg-page px-4 py-12 text-ink">
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-card p-8 shadow-[var(--shadow-modal)]">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Rent Sync</p>
            <h1 className="mt-3 text-3xl font-bold text-ink">Property management</h1>
          </div>

          <div className="mb-6 flex gap-2 rounded-xl bg-subtle p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`no-scale flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-[var(--color-button)] text-[var(--color-button-text)] shadow-sm' : 'text-muted hover:bg-hover'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`no-scale flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-[var(--color-button)] text-[var(--color-button-text)] shadow-sm' : 'text-muted hover:bg-hover'}`}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-muted">Full name</label>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  className="w-full rounded-lg border border-[var(--border-control)] bg-card px-3 py-2"
                  placeholder="Jane Landlord"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Email</label>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                className="w-full rounded-lg border border-[var(--border-control)] bg-card px-3 py-2"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  className="w-full rounded-lg border border-[var(--border-control)] bg-card px-3 py-2 pr-11"
                  placeholder={showPassword ? 'Your password' : '••••••••'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="no-scale absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-faint hover:text-muted focus:outline-none focus-visible:text-accent"
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
                <label className="mb-1 block text-sm font-medium text-muted">Role</label>
                <select
                  disabled
                  value="landlord"
                  className="w-full rounded-lg border border-[var(--border-control)] bg-card px-3 py-2 opacity-70"
                >
                  <option value="landlord">Landlord</option>
                </select>
                <p className="mt-1 text-xs text-faint">New accounts are always registered as Landlord. Privileged roles are granted by an existing admin.</p>
              </div>
            )}

            {error && <p className="text-sm text-[var(--kpi-red)]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--color-button)] px-4 py-3 font-semibold text-[var(--color-button-text)] shadow-[var(--shadow-md)] transition hover:bg-[var(--color-button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>

            {mode === 'login' && (
              <div className="pt-2">
                <div className="mb-3 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div id="google-signin-wrap" className="relative h-11 w-full">
                  <div
                    id="google-signin-button"
                    className="absolute inset-0 z-10 h-11 w-full opacity-0"
                    aria-hidden="true"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-button)] text-sm font-semibold text-[var(--color-button-text)]"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" focusable="false" aria-hidden="true">
                      <path
                        fill="currentColor"
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

  // The paywall. Placed after the auth gate so a signed-in, unpaid account sees this instead of the
  // dashboard. `subscriptionStatus === null` falls through to the dashboard, because a null means
  // "not known yet" (still fetching, or billing unreachable) and must not lock a paying customer out.
  if (subscriptionStatus !== null && subscriptionStatus !== 'active') {
    return (
      <Paywall
        onActivated={() => {
          setSubscriptionStatus(null);
          getBilling()
            .then((state) => {
              setSubscriptionStatus(state.subscription.status);
              setEntitlement(state.entitlement);
              if (state.subscription.status === 'active') loadProperties(false, state.entitlement);
            })
            .catch(() => {
              setSubscriptionStatus('active');
              setEntitlement(null);
            });
        }}
        onSignOut={handleLogout}
      />
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

  // Amount still owed on an invoice = its face value minus what has actually been paid against it.
  // Summing the FULL amount of every non-paid invoice (the previous behaviour) ignored part-payments,
  // so the dashboard overstated arrears and contradicted the Reports → arrears table, which nets
  // payments off correctly. Both figures are now computed the same way.
  const paidAgainstInvoice = (invoiceId: number) =>
    payments
      .filter((payment) => payment.invoice_id === invoiceId && payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const outstandingOnInvoice = (invoice: Invoice) =>
    Math.max(Number(invoice.amount) - paidAgainstInvoice(invoice.id), 0);

  // Totals for active tenants only — old records (moved_out/archived) keep history but don't inflate outstanding
  const totalCollected = payments
    .filter((p) => p.status === 'completed' && activeTenants.some((t) => t.id === p.tenant_id))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'paid' && activeTenants.some((t) => t.id === inv.tenant_id))
    .reduce((sum, invoice) => sum + outstandingOnInvoice(invoice), 0);
  const recentInvoices = invoices.slice(0, 5);
  const unmatchedPaymentCount = payments.filter((payment) => payment.matched === false).length;

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
        .reduce((sum, invoice) => sum + outstandingOnInvoice(invoice), 0);

      const paidCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'paid').length;
      const partialCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'partial').length;
      const overdueCount = propertyTenants.filter((tenant) => getTenantRentStatus(tenant).status === 'overdue').length;

        return {
          property,
          // The units the landlord declared on the property, not the number of tenant records.
          // Billing measures the plan ceiling as SUM(properties.units), so counting tenants here
          // would show a landlord sitting on "4 units" for a block they declared as 50 - and then
          // refuse their 51st unit with a message quoting a number the dashboard never showed.
          totalUnits: Number(property.units) || 0,
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

  const dashboard: DashboardValue = {
    user,
    subscriptionStatus,
    entitlement,

    properties,
    tenants,
    invoices,
    payments,
    maintenance,
    paymentChannels,
    reconciliationAlerts,
    reconciliationSummary,
    arrears,
    collectionRate,
    tenantStatement,
    setTenantStatement,

    loading,
    dataLoading,
    refreshing,
    lastUpdated,
    error,
    invoiceNotice,
    generatingInvoices,
    reportsLoading,
    reportsError,

    recordPaymentNotice,
    recordError,
    savingPayment,
    recordingInvoiceId,
    recordAmount,
    recordMethod,
    recordReference,
    setRecordAmount,
    setRecordMethod,
    setRecordReference,

    propertyForm,
    setPropertyForm,
    editPropertyForm,
    setEditPropertyForm,
    propertyErrors,
    setPropertyErrors,
    tenantForm,
    setTenantForm,
    maintenanceForm,
    setMaintenanceForm,
    paymentChannelForm,
    setPaymentChannelForm,
    manualPaymentForm,
    setManualPaymentForm,
    paymentChannelError,
    paymentChannelLoading,

    attentionFilter,
    setAttentionFilter,
    attentionSearch,
    setAttentionSearch,
    attentionPropertyFilter,
    setAttentionPropertyFilter,
    tenantRosterSearch,
    setTenantRosterSearch,
    reportPropertyFilter,
    setReportPropertyFilter,
    reportStatementTenantId,
    setReportStatementTenantId,

    selectedPropertyForUnits,
    setSelectedPropertyForUnits,
    selectedTenantId,
    setSelectedTenantId,
    editingPropertyId,
    setEditingPropertyId,
    deletingPropertyId,

    activeTenants,
    tenantRoster,
    maintenanceActionQueue,
    escalatedUrgent,
    totalCollected,
    totalOutstanding,
    recentInvoices,
    unmatchedPaymentCount,
    propertySummaries,
    propertyPaymentStatus,
    attentionItems,
    selectedTenant,
    selectedTenantInvoices,
    selectedTenantPayments,
    selectedTenantSummary,

    page,
    goTo: (next) => goTo(next),
    modal,
    openModal: (next) => setModal(next),
    closeModal: () => setModal(null),

    can,
    loadProperties,
    startCollecting,
    handleRefresh,
    handleLogout,
    handleSetupAction,
    handleGenerateInvoices,
    handleTenantsImported,

    validatePropertyForm,
    handlePropertySubmit,
    handlePropertyUpdate,
    handlePropertyEditStart,
    handlePropertyDelete,
    handleTenantSubmit,
    handleTenantLifecycleAction,
    handleMaintenanceSubmit,
    handleMaintenanceStatusChange,
    handleMaintenanceEscalate,
    handleMaintenanceDelete,
    handleManualPaymentReconciliation,
    handlePaymentChannelSubmit,
    handlePaymentChannelToggle,
    handlePaymentChannelSync,
    handlePaymentChannelDelete,
    loadPaymentChannels,
    loadReports,
    handleTenantStatementLoad,

    openRecordPayment,
    closeRecordPayment,
    handleSaveRecordedPayment,

    downloadArrearsCsv,
    downloadCollectionRateCsv,
    downloadTenantStatementCsv,
  };

  return (
    <DashboardContext.Provider value={dashboard}>
      <AppShell />
    </DashboardContext.Provider>
  );
}
