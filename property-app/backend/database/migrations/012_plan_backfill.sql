-- Give every active account a real plan, so the feature gates have something to read.
--
-- 010 added users.plan as a bare nullable TEXT with no default. That was correct when the column
-- only mattered for the paywall, which keys off subscription_status: an account that had paid had
-- 'active' and a NULL plan cost it nothing. It stops being harmless now that PLANS also decides
-- which features an account gets, because a NULL plan read by the feature gate would be an account
-- with no entitlements at all - a landlord who had entered a year of properties and tenants would
-- open the dashboard after this deploy and find most of it gone.
--
-- So every account that predates billing is given the top tier. That is the only choice that
-- cannot take something away from someone who is already using the product, and the plan column
-- records what they are entitled to rather than what they have been charged: nobody had been
-- charged, because there was nothing to charge before /pay existed.
--
-- 012 also backfills units_limit, which had the same problem. It is read for display only - the cap
-- is enforced against PLANS[plan].unitCeiling, which cannot go stale - but a NULL there would
-- render as "no limit" next to a plan that has one.
--
-- Idempotent, and safe to run before or after the code that reads these columns.

-- Accounts with no plan at all: the pre-billing grandfathered set.
UPDATE users
   SET plan = 'enterprise',
       units_limit = NULL
 WHERE plan IS NULL;

-- Accounts with a plan but no matching limit get that plan's ceiling, so the number shown to the
-- landlord agrees with the number enforced. Enterprise is deliberately left NULL, meaning no cap.
UPDATE users u
   SET units_limit = CASE u.plan
                       WHEN 'basic' THEN 20
                       WHEN 'standard' THEN 50
                       WHEN 'premium' THEN 100
                       ELSE NULL
                     END
 WHERE u.plan IS NOT NULL
   AND u.units_limit IS DISTINCT FROM CASE u.plan
                                         WHEN 'basic' THEN 20
                                         WHEN 'standard' THEN 50
                                         WHEN 'premium' THEN 100
                                         ELSE NULL
                                       END;

-- The counts are hardcoded above rather than read from config/plans.js on purpose: a migration that
-- imported application code would behave differently as that code changed, and a schema migration
-- has to mean the same thing every time it runs. If a ceiling ever changes in plans.js, change it
-- here too - and note that existing accounts keep the limit they were given, which is the correct
-- behaviour for a price rise mid-term.
