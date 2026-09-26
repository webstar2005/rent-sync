// Prints the exact callback URL to register in the PayHero dashboard.
//
// PayHero signs no callback and can set no custom header on it, so the shared secret has to travel in
// the query string of the callback URL that WE register. Run this to get that URL, then paste it into
// the PayHero portal (Settings -> callback URL). Registering the channel through our dashboard API
// cannot do it for us: POST /payment_channels accepts only channel_type, account_id, short_code,
// account_number and description - there is no callback_url field.
//
// Usage (reads .env.production, or the ambient environment if that file lacks the key):
//   node scripts/print-payhero-callback-url.js
//
// NOTE: this prints a live secret. Run it on a trusted machine and do not paste the output into a
// ticket, chat, or commit. If it is ever exposed, rotate PAYHERO_WEBHOOK_SECRET in Render AND in the
// PayHero dashboard together - a rotation only takes effect once both sides agree.
import { payheroCallbackUrl } from '../src/services/payhero.js';

try {
  const url = payheroCallbackUrl();
  console.log('\nPaste this into the PayHero dashboard (Settings -> callback URL):\n');
  console.log(url);
  console.log('\nVerify with a GET/POST to that URL: 403 with status=forbidden means the secret');
  console.log('matched (auth passed, no payment in the body). A 403 logging secret_missing means');
  console.log('Render and this script are reading different PAYHERO_WEBHOOK_SECRET values.');
  console.log('');
} catch (error) {
  console.error(`\n${error.message}\n`);
  console.error('Local .env.production does not define PAYHERO_WEBHOOK_SECRET, and neither does this');
  console.error('shell. Get the value from Render (rent-sync-api -> Environment), export it, re-run:');
  console.error('  $env:PAYHERO_WEBHOOK_SECRET = "<value from Render>"\n');
  process.exitCode = 1;
}
