// Live PayHero smoke test — requires PAYHERO_AUTH_TOKEN + PAYHERO_ACCOUNT_ID in .env.
// Phase 1: read-only — channels and PayHero's bank-paybill reference list.
import '../src/config/env.js';
import { listChannels, listBankPaybills } from '../src/services/payhero.js';

(async () => {
  for (const [label, fn] of [
    ['listChannels()', listChannels],
    ['listBankPaybills()', listBankPaybills],
  ]) {
    try {
      console.log(`\n== ${label} ==`);
      console.log(JSON.stringify(await fn(), null, 2));
    } catch (error) {
      console.log(`\n== ${label} ERROR ==`);
      console.log(error.message);
    }
  }
})();