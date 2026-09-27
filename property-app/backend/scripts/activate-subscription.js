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
//   node scripts/activate-subscription.js ruth@example.com premium --code QJG7X2M4KL
//   node scripts/activate-subscription.js ruth@example.com premium --units 120   # override the ceiling
//   node scripts/activate-subscription.js ruth@example.com --no-claim --reason "paid by phone"
//   node scripts/activate-subscription.js ruth@example.com --suspend
//   node scripts/activate-subscription.js ruth@example.com --reactivate
//
// --code is REQUIRED for a normal activation and must match a pending claim from that same
// account: the claim is the only record linking a payment to a person, so an unverified code would
// make the audit trail decorative. For a payment taken outside the app (phone, cash, bank
// transfer) use --no-claim --reason "..." instead, which is recorded in its place.
//
// --list prints a ready-made --code command for every pending claim, so the normal path is:
//
//   node scripts/activate-subscription.js --list
//   node scripts/activate-subscription.js <the printed command>
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
  const noClaim = flags.has('--no-claim');
  const reason = valueOf('--reason');
  const by = valueOf('--by') ?? 'admin-cli';

  if (code && noClaim) {
    die('--code and --no-claim contradict each other. Drop --no-claim to activate against a submitted claim.');
  }
  if (noClaim && !reason) {
    die('--no-claim needs --reason "<what proves this payment>", so the audit trail is not empty.');
  }

  // THE PAYER'S CLAIM IS THE EVIDENCE, so it has to actually exist and belong to this account.
  // Previously --code was optional and unvalidated: any string could switch an account on and be
  // stored as payment_reference, and a code that matched nothing failed silently, leaving an admin
  // believing they had an audit trail when they had none.
  let claim = null;
  if (!noClaim) {
    if (!code) {
      die(
        'Pass --code <mpesa code> to activate against a submitted claim, or ' +
          '--no-claim --reason "..." for a payment taken outside the app (phone, cash, transfer).'
      );
    }
    const { rows } = await client.query(
      `SELECT id, plan, amount FROM payment_requests
        WHERE user_id = $1 AND mpesa_confirmation_code = $2 AND status = 'pending'`,
      [user.id, code]
    );
    claim = rows[0] ?? null;
    if (!claim) {
      die(
        `No pending claim from ${user.email} with code ${code}. ` +
          'Check the code against --list; it may be mistyped, already reviewed, or belong to another account.'
      );
    }
    if (claim.plan !== plan.key) {
      console.warn(
        `WARNING: the claim was for ${claim.plan} (KES ${claim.amount}) but you are activating ` +
          `${plan.key} (KES ${plan.amount}). Only continue if the larger payment is on the statement.`
      );
    }
  }

  // A plan that covers fewer units than the landlord already manages is refused, and the refusal
  // names the number rather than just saying no.
  //
  // The cap is enforced on property create and update (services/units.js), so without this a
  // downgrade would leave an account over its own limit by hundreds of units with no way back: the
  // code that checks the cap would then block every future edit to every property, including edits
  // that *reduce* the count only once they were already past the line. Refusing the plan change
  // keeps the account in a state the rest of the product can reason about.
  const usage = await client.query(
    'SELECT COALESCE(SUM(units), 0)::int AS units FROM properties WHERE owner_id = $1',
    [user.id]
  );
  const units = usage.rows[0]?.units ?? 0;
  if (units > unitsLimit) {
    die(
      `${user.email} manages ${units} units, which is over the ${unitsLimit} that ${plan.name} ` +
        `allows. Move them to a larger plan, or reduce the unit count on their properties first. ` +
        `Unit count is the sum of properties.units, so editing those is what changes it.`
    );
  }

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE users
       SET subscription_status = 'active',
           plan = $2,
           units_limit = $3,
           activated_at = COALESCE(activated_at, NOW()),
           payment_reference = $4,
           payment_confirmed_by = $5,
           payment_confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, plan.key, unitsLimit, noClaim ? reason : code, by]
    );

    // Close the claim out so --list stops showing it. reviewed_by is resolved from a real admin
    // row rather than invented, so it stays NULL when no admin account exists.
    if (claim) {
      const { rowCount } = await client.query(
        `UPDATE payment_requests
           SET status = 'approved',
               reviewed_by = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
               reviewed_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
        [claim.id]
      );
      if (rowCount === 0) die(`Claim #${claim.id} changed state while you were typing. Nothing was applied.`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    die(`Database rejected the change: ${err.message}`);
  }

  console.log(`Activated ${user.email}`);
  console.log(`  plan:   ${plan.name}`);
  console.log(`  units:  ${unitsLimit}`);
  console.log(`  by:     ${by}`);
  if (claim) {
    console.log(`  claim:  #${claim.id} approved (code ${code})`);
    console.log(`  record: payment_reference = ${code}`);
  } else {
    console.log(`  claim:  none - activated without a submitted code`);
    console.log(`  record: payment_reference = ${reason}`);
  }
  console.log('They are unlocked on their next request - no sign-in needed.');
} finally {
  await client.end();
}
