// Wave-1 live test: initiate a real M-Pesa STK push through a registered PayHero channel using the
// free test credits, then poll its status. PayHero will POST the result to the path we set as
// callback_url (see PAYHERO_TEST_CALLBACK_URL) — that should land on our /webhooks/payhero endpoint.
//
// Required env (set in backend/.env): PAYHERO_AUTH_TOKEN (already set).
//    PAYHERO_TEST_PHONE       — M-Pesa phone number that should receive the test push (e.g. 2547XXXXXXXX)
//    PAYHERO_TEST_AMOUNT      — default 1 (KES)
//    PAYHERO_TEST_CHANNEL_ID  — default 12891 (the bank channel registered earlier)
//    PAYHERO_TEST_CALLBACK_URL — optional per-request callback (public URL to our webhook)
//    PAYHERO_TEST_REFERENCE   — RECOMMENDED. A real invoice_number from your dashboard (e.g. INV-3-202610).
//                               This becomes PayHero's ExternalReference, which is the field our webhook
//                               correlates on, so passing a real invoice number is what makes the payment
//                               land against that invoice instead of arriving unmatched.
import '../src/config/env.js';
import { initiateStkPush, getTransactionStatus } from '../src/services/payhero.js';

const phone = process.env.PAYHERO_TEST_PHONE;
const amount = Number(process.env.PAYHERO_TEST_AMOUNT || 1);
const channelId = Number(process.env.PAYHERO_TEST_CHANNEL_ID || 12891);
const callbackUrl = process.env.PAYHERO_TEST_CALLBACK_URL || '';
const requestedReference = process.env.PAYHERO_TEST_REFERENCE || '';

if (!phone) {
  console.error('Set PAYHERO_TEST_PHONE (2547XXXXXXXX) in backend/.env first.');
  process.exit(1);
}

// Previously this was always `INV-<timestamp>`, which matches no invoice — the payment could only ever
// arrive unmatched. A unique placeholder is still generated when no real invoice number is supplied, so
// the script still works as a pure connectivity probe.
const externalReference = requestedReference || `UNMATCHED-PROBE-${Date.now()}`;
let pollRef = externalReference;

if (requestedReference) {
  console.log(`Using your real invoice number as ExternalReference: ${externalReference}`);
  console.log('This payment should be matched to that invoice and mark it paid / partial.');
} else {
  console.log('\nWARNING: PAYHERO_TEST_REFERENCE is not set.');
  console.log('The payment will NOT match any invoice and will be recorded as needing reconciliation.');
  console.log("Copy an invoice_number from the dashboard's \"Recent invoices\" table and re-run with");
  console.log('PAYHERO_TEST_REFERENCE set to see the fully-matched path instead.');
}

console.log(`\nInitiating STK push -> channel ${channelId}, amount ${amount} KES, phone ${phone}`);
console.log(`external_reference      = ${externalReference}`);
if (callbackUrl) console.log(`callback_url             = ${callbackUrl}`);

try {
  const init = await initiateStkPush({ amount, phoneNumber: phone, channelId, externalReference, callbackUrl });
  console.log('\n== initiateStkPush() ==');
  console.log(JSON.stringify(init, null, 2)); // typically { success, status, reference, CheckoutRequestID, external_reference }
  // transaction-status looks up by the returned `reference`, not the external reference
  pollRef = init.reference || init.CheckoutRequestID || externalReference;
} catch (error) {
  console.error('\n== initiateStkPush() ERROR ==');
  console.error(error.message);
  process.exit(1);
}

console.log(`\nPolling status for ${pollRef}...`);
const deadline = Date.now() + 60_000;
for (let round = 0; Date.now() < deadline; round++) {
  await new Promise((r) => setTimeout(r, 4000));
  try {
    const status = await getTransactionStatus(pollRef);
    console.log(`[${round + 1}]`, JSON.stringify(status));
    const text = JSON.stringify(status).toLowerCase();
    if (text.includes('success') || text.includes('completed') || text.includes('processed')) break;
  } catch (error) {
    console.log(`[${round + 1}] status ERROR:`, error.message);
  }
}