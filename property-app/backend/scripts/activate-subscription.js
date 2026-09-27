// Switches a Rent Sync subscription on or off by hand.
//
// Rent Sync is paid by M-Pesa Send Money to a business phone number. A Send Money transfer records
// no reference we can read, so nothing can be automated safely: the payer quotes the confirmation
// code from their SMS, an admin checks that code against the M-Pesa statement, and only then runs
// this. It is deliberately a CLI rather than an HTTP route - it grants access to paid features, so
// it should require shell access to the box, not a logged-in browser session.
//
// Usage (from property-app/backend):
//   node scripts/activate-subscription.js --list
//   node scripts/activate-subscription.js ruth@example.com premium
//   node scripts/activate-subscription.js ruth@example.com premium --code QJG7X2M4KL
//   node scripts/activate-subscription.js ruth@example.com --units 120        # override the ceiling
//   node scripts/activate-subscription.js ruth@example.com --suspend
//   node scripts/activate-subscription.js ruth@example.com --reactivate
//
// DATABASE_URL comes from the environment, or from backend/.env.production (gitignored) if present.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';
import { PLANS, isPlanKey } from '../src/config/plans.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backDir, '.env.production'), override: false });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || dbUrl.includes('__SET_VIA_SECRET_MANAGER__') || !dbUrl.startsWith('postgresql://')) {
  console.error(
    '[activate-subscription] Set DATABASE_URL to the Neon connection string in backend/.env.production (gitignored), or in the environment, then re-run.'
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
};

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

function die(msg) {
  console.error(`[activate-subscription] ${msg}`);
  process.exit(1);
}

try {
  if (flags.has('--list')) {
    const { rows } = await client.query(
      `SELECT pr.id, pr.plan, pr.amount, pr.mpesa_confirmation_code, pr.created_at,
              u.email, u.subscription_status
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.status = 'pending'
       ORDER BY pr.created_at ASC`
    );
    if (rows.length === 0) {
      console.log('No pending payment requests.');
    } else {
      console.log('Pending payment requests (oldest first):\n');
      for (const r of rows) {
        console.log(`  #${r.id}  ${r.email}  ${r.plan}  KES ${r.amount}`);
        console.log(`      code: ${r.mpesa_confirmation_code}`);
        console.log(`      sent: ${r.created_at.toISOString()}`);
        console.log(`      activate: node scripts/activate-subscription.js ${r.email} ${r.plan} --code ${r.mpesa_confirmation_code}`);
        console.log('');
      }
    }
    process.exit(0);
  }

  const email = positional[0];
  if (!email) die('An account email is required. Run with --list to see what is waiting.');

  const { rows: found } = await client.query(
    `SELECT id, email, subscription_status, plan, units_limit FROM users WHERE email = $1`,
    [email]
  );
  const user = found[0];
  if (!user) die(`No account with email ${email}.`);

  // Suspend / reactivate, which need no plan argument.
  if (flags.has('--suspend')) {
    await client.query(`UPDATE users SET subscription_status = 'suspended' WHERE id = $1`, [user.id]);
    console.log(`Suspended ${user.email}. They keep their login but lose the product.`);
    process.exit(0);
  }

  if (flags.has('--reactivate')) {
    await client.query(
      `UPDATE users SET subscription_status = 'active', activated_at = COALESCE(activated_at, NOW()) WHERE id = $1`,
      [user.id]
    );
    console.log(`Reactivated ${user.email}.`);
    process.exit(0);
  }

  const planKey = positional[1];
  if (!isPlanKey(planKey)) {
    die(`A plan key is required: one of ${Object.keys(PLANS).join(', ')}.`);
  }
  const plan = PLANS[planKey];

  const unitsOverride = valueOf('--units');
  let unitsLimit = plan.unitCeiling;
  if (unitsOverride !== null) {
    const n = Number(unitsOverride);
    if (!Number.isInteger(n) || n <= 0) die('--units must be a positive whole number.');
    unitsLimit = n;
  }
  if (unitsLimit === null) unitsLimit = 100000; // enterprise: effectively uncapped

  const code = valueOf('--code');

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE users
       SET subscription_status = 'active',
           plan = $2,
           units_limit = $3,
           activated_at = COALESCE(activated_at, NOW()),
           payment_reference = $4,
           payment_confirmed_by = 'admin-cli',
           payment_confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, plan.key, unitsLimit, code]
    );

    // If the payer submitted this code, close the request out so --list stops showing it.
    if (code) {
      await client.query(
        `UPDATE payment_requests
         SET status = 'approved', reviewed_at = NOW()
         WHERE user_id = $1 AND mpesa_confirmation_code = $2 AND status = 'pending'`,
        [user.id, code]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    die(`Database rejected the change: ${err.message}`);
  }

  console.log(`Activated ${user.email}`);
  console.log(`  plan:   ${plan.name}`);
  console.log(`  units:  ${unitsLimit}`);
  console.log(`  code:   ${code ?? '(none recorded - pass --code <mpesa code> to keep the audit trail)'}`);
  console.log('They are unlocked on their next request - no sign-in needed.');
} finally {
  await client.end();
}
