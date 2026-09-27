-- Tighten M-Pesa confirmation-code uniqueness so one payment can never switch on two accounts.
--
-- WHAT 010 GOT WRONG
-- 010 guarded a code only while a claim was PENDING:
--     CREATE UNIQUE INDEX ... ON payment_requests (mpesa_confirmation_code) WHERE status = 'pending'
-- A partial index only covers the rows it names. The moment an admin approved a claim, that row
-- left the index and the code became claimable again by any other account, producing a second,
-- separately-approvable claim. One Send Money transfer, two active subscriptions - which is
-- precisely the outcome 010's own comment claimed to be preventing.
--
-- WHY THE FIX IS SAFE
-- A Safaricom confirmation code is unique per transfer, not per account, so the true invariant is
-- that a code is used at most once across the whole table, whatever its status. Rejected codes stay
-- blocked as well, and that is deliberate: a code an admin has already judged not to match our
-- statement should not be re-claimable.
--
-- The pending-only index is dropped rather than kept alongside, so there is exactly one index and
-- therefore exactly one ON CONFLICT target. Keeping both would leave the weaker one available to
-- infer against and the guarantee ambiguous.

-- Duplicates would make the index below impossible to build. That is a real finding to investigate,
-- never something to delete rows to force through, so stop loudly and name it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_requests GROUP BY mpesa_confirmation_code HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'duplicate mpesa_confirmation_code values exist in payment_requests; investigate and resolve them before applying 011';
  END IF;
END
$$;

DROP INDEX IF EXISTS idx_payment_requests_pending_code;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_code_unique
  ON payment_requests (mpesa_confirmation_code);

-- The admin queue reads pending rows oldest-first; 010's partial index on created_at still serves
-- that, and is left in place.
