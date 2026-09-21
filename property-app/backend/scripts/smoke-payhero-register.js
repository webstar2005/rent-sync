// Phase 2: live registration attempt against PayHero using one of PayHero's own bank paybills.
// Bank channels need no short code owned by us — proves the register -> list round-trip for real.
import '../src/config/env.js';
import { registerChannel, listChannels } from '../src/services/payhero.js';

const attempt = {
  channelType: 'bank',
  shortCode: '522522', // KCB — PayHero-registered bank paybill
  description: 'KCB Bank (test channel)',
};

try {
  const created = await registerChannel(attempt);
  console.log('== registerChannel() SUCCESS ==');
  console.log(JSON.stringify(created, null, 2));
} catch (error) {
  console.log('== registerChannel() ERROR ==');
  console.log(error.message);
}

try {
  console.log('\n== listChannels() after attempt ==');
  console.log(JSON.stringify(await listChannels(), null, 2));
} catch (error) {
  console.log('listChannels ERROR:', error.message);
}