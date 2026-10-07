-- Migration 015: make `units` a real projection of what the landlord declared and who lives there.
--
-- PROBLEM. `properties.units` is the landlord's own declaration ("Block AB = 72") and is the number
-- the plan cap is measured against, but nothing ever wrote those units into the `units` table.
-- 014 backfilled units FROM tenants, so it could only ever produce rows for flats that already had
-- a tenant: a block declared at 72 with one tenant yielded one row, and a block with no tenants
-- yielded none. The Units panel therefore rendered an empty list for a 72-unit block, and even the
-- one tenant that did exist (unit G1A) had no unit record at all.
--
-- The forensics on the production database made the gap unambiguous: units_id_seq had never been
-- called and the table had zero heap pages, meaning no row had ever been inserted or deleted - the
-- table had been empty since the moment 014 created it. Nothing was lost; nothing was ever written.
--
-- FIX. One function that reconciles a property, called again from every property and tenant
-- mutation so the projection cannot drift back. It runs in three passes and NEVER deletes a row:
--
--   a. a unit marked occupied whose tenant is gone (the FK's ON DELETE SET NULL clears tenant_id but
--      leaves status='occupied') or no longer active is released. 'occupied' means "a tenant lives
--      here"; a flat held without a tenant is `reserved`.
--   b. every active tenant gets a unit - one that already carries its unit_number is linked, and a
--      number that is not there yet takes over a spare filler so the block stays at its declared
--      size. This is what gives Susan Oganga's G1A a row.
--   c. the property is topped up to its declared count with vacant units.
--
-- Fillers are numbered 01, 02, ... zero-padded to the width of the declared count so the panel's
-- default ORDER BY unit_number (text) reads 01, 02, ... 10 rather than 01, 10, 02. Numbers already
-- in use are skipped, so a tenant on G1A keeps that number instead of colliding with the unique
-- (property_id, unit_number) index.
--
-- Re-running is a no-op once the counts match, so the migration and the request handlers can both
-- call it unconditionally.

CREATE OR REPLACE FUNCTION materialise_units(p_property_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_declared  INTEGER;
  v_have      INTEGER;
  v_need      INTEGER;
  v_width     INTEGER;
  v_created   INTEGER := 0;
  v_filled    INTEGER := 0;
  v_candidate TEXT;
  v_g         INTEGER;
  t_rec       RECORD;
BEGIN
  SELECT units INTO v_declared FROM properties WHERE id = p_property_id;
  IF v_declared IS NULL THEN
    RETURN 0;
  END IF;

  -- a. release units whose tenant is no longer there or no longer active
  UPDATE units
     SET tenant_id = NULL,
         status = 'vacant'
   WHERE property_id = p_property_id
     AND status = 'occupied'
     AND (tenant_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM tenants t
             WHERE t.id = units.tenant_id
               AND t.property_id = p_property_id
               AND t.status = 'active'
          ));

  -- b. every active tenant gets a unit. Prefer a free unit carrying that number, so re-running
  --    links rather than creates, and so one tenant can never take over two rows.
  FOR t_rec IN
    SELECT id, unit_number, monthly_rent
      FROM tenants
     WHERE property_id = p_property_id
       AND status = 'active'
     ORDER BY id
  LOOP
    IF EXISTS (
      SELECT 1 FROM units u
       WHERE u.property_id = p_property_id
         AND lower(u.unit_number) = lower(t_rec.unit_number)
    ) THEN
      UPDATE units u
         SET tenant_id = t_rec.id,
             status = 'occupied',
             monthly_rent = t_rec.monthly_rent
       WHERE u.id = (
         SELECT u2.id FROM units u2
          WHERE u2.property_id = p_property_id
            AND lower(u2.unit_number) = lower(t_rec.unit_number)
          ORDER BY (u2.tenant_id IS NULL) DESC, u2.id
          LIMIT 1
       );
    ELSE
      -- The tenant's number is not among the rows already there. Repurposing the last vacant filler
      -- rather than inserting keeps the block at the count the landlord declared: Susan lives in one
      -- of Block AB's seventy-two flats, she does not turn it into seventy-three. Only when every
      -- filler is already spoken for - more active tenants than declared flats - does the row count
      -- grow past the declaration, because a tenant who exists must always have a row to live in.
      -- The `^[0-9]+$` test limits this to rows numbered the way fillers are numbered, so a unit a
      -- landlord created under their own name (G1A, Roof Terrace) is never relabelled.
      UPDATE units u
         SET unit_number = t_rec.unit_number,
             tenant_id = t_rec.id,
             status = 'occupied',
             monthly_rent = t_rec.monthly_rent
       WHERE u.id = (
         SELECT u2.id FROM units u2
          WHERE u2.property_id = p_property_id
            AND u2.tenant_id IS NULL
            AND u2.status = 'vacant'
            AND u2.unit_number ~ '^[0-9]+$'
          ORDER BY u2.unit_number DESC
          LIMIT 1
       );

      IF NOT FOUND THEN
        INSERT INTO units (property_id, unit_number, status, tenant_id, monthly_rent)
        VALUES (p_property_id, t_rec.unit_number, 'occupied', t_rec.id, t_rec.monthly_rent);
        v_created := v_created + 1;
      END IF;
    END IF;
  END LOOP;

  -- c. top up to the declared count with vacant units
  SELECT COUNT(*) INTO v_have FROM units WHERE property_id = p_property_id;
  v_need := GREATEST(v_declared - v_have, 0);

  IF v_need > 0 THEN
    v_width := GREATEST(2, length(v_declared::text));
    v_g := 1;
    -- Bounded rather than WHILE TRUE: the bound only has to exceed every candidate we could want,
    -- and an unreachable exit would hang the request instead of failing it.
    WHILE v_filled < v_need AND v_g <= (v_declared + v_have + 1000) LOOP
      v_candidate := lpad(v_g::text, v_width, '0');
      IF NOT EXISTS (
        SELECT 1 FROM units u
         WHERE u.property_id = p_property_id
           AND u.unit_number = v_candidate
      ) THEN
        INSERT INTO units (property_id, unit_number, status)
        VALUES (p_property_id, v_candidate, 'vacant');
        v_filled := v_filled + 1;
        v_created := v_created + 1;
      END IF;
      v_g := v_g + 1;
    END LOOP;
  END IF;

  RETURN v_created;
END;
$$;

-- Backfill every property that exists before this migration runs. A property that is already at its
-- declared count, or is below it because units were added by hand, is left exactly as it is.
SELECT materialise_units(id) FROM properties;
