-- RETIRED: BE permission changes were pulled on 2026-10-15.
-- The temporary grants overlap official CRUISE_READ / ITINERARY_READ /
-- CRUISE_STOP_READ. Do not delete them based on the old test setup.
-- Let the corrected BE initializer own the complete role permission set.
DO $$
BEGIN
  RAISE EXCEPTION 'Retired rollback: compare and apply the official BE permission initializer instead.';
END $$;
