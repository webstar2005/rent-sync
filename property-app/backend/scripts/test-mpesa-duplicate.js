// Test M-Pesa duplicate callback idempotency (Phase 6)
// Run: node scripts/test-mpesa-duplicate.js
// Requires: backend running on http://localhost:4000, and a landlord account + property/tenant/invoice already created
// Or set MPESA_CALLBACK_URL to your ngrok if testing Daraja simulator

const API = process.env.API_URL || 'http://localhost:4000';

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'landlord@example.com', password: 'password123' }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data));
  return data.token;
}

async function setupProperty(token) {
  // Create property if not exists
  const propRes = await fetch(`${API}/api/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test Property', address: 'Test Address', units: 5 }),
  });
  const prop = await propRes.json();
  const propertyId = prop.id || (await (await fetch(`${API}/api/properties`, { headers: { Authorization: `Bearer ${token}` } })).json())[0]?.id;
  console.log('property', propertyId);

  // Set payment settings for matching
  await fetch(`${API}/api/properties/${propertyId}/payment-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ property_id: propertyId, mpesa_paybill: '174379', mpesa_till: '174379', allowed_methods: ['mobile_money', 'bank_transfer'] }),
  });

  return propertyId;
}

async function ensureTenantAndInvoice(token, propertyId) {
  const tenants = await (await fetch(`${API}/api/tenants`, { headers: { Authorization: `Bearer ${token}` } })).json();
  let tenant = tenants.find((t) => t.name === 'Test Tenant');
  if (!tenant) {
    const res = await fetch(`${API}/api/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ property_id: propertyId, name: 'Test Tenant', phone: '254712345678', unit_number: 'A1', monthly_rent: 1000 }),
    });
    tenant = await res.json();
  }
  console.log('tenant', tenant.id);

  const invoices = await (await fetch(`${API}/api/invoices`, { headers: { Authorization: `Bearer ${token}` } })).json();
  let invoice = invoices.find((i) => i.tenant_id === tenant.id && i.status !== 'paid');
  if (!invoice) {
    const res = await fetch(`${API}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenant_id: tenant.id, property_id: propertyId, invoice_number: `INV-TEST-${Date.now()}`, amount: 1000, due_date: new Date().toISOString().slice(0, 10) }),
    });
    invoice = await res.json();
  }
  console.log('invoice', invoice.id, invoice.invoice_number);
  return { tenant, invoice };
}

async function sendCallback(transactionRef, tenantName, amount, businessShortCode = '174379') {
  const payload = {
    Body: {
      stkCallback: {
        MerchantRequestID: 'test-merchant',
        CheckoutRequestID: 'ws_CO_test',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: amount },
            { Name: 'MpesaReceiptNumber', Value: transactionRef },
            { Name: 'TransactionDate', Value: 20240101120000 },
            { Name: 'PhoneNumber', Value: 254712345678 },
          ],
        },
        AccountReference: tenantName,
        BusinessShortCode: businessShortCode,
      },
    },
  };
  const res = await fetch(`${API}/api/mpesa/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log(`callback ${transactionRef} ->`, data);
  return data;
}

async function main() {
  const token = await login();
  const propertyId = await setupProperty(token);
  const { tenant } = await ensureTenantAndInvoice(token, propertyId);
  const ref = `TESTTXN${Date.now()}`;
  console.log('--- First callback (should be matched) ---');
  await sendCallback(ref, tenant.name, 1000);
  console.log('--- Second callback same ref (should be duplicate) ---');
  await sendCallback(ref, tenant.name, 1000);
  console.log('Done — check DB: SELECT * FROM payment_reconciliation_events WHERE transaction_ref=$1', ref);
}

main().catch((e) => { console.error(e); process.exit(1); });
