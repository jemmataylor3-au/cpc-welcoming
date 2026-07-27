-- ============================================================================
-- CPC Welcoming Team App — "Just visiting" reason
-- ============================================================================
-- Adds a "Just visiting" option to reason_for_attendance. Visitors added
-- with this reason are archived immediately on creation (handled in the
-- app's Add Visitor form) — they never enter the Active pipeline, since
-- there's no follow-up journey to track for someone passing through.
--
-- NOTE: adding a value to an existing enum must be committed before that
-- value can be used. Run this migration ON ITS OWN, in its own query,
-- before running anything that references 'Just visiting'.
-- ============================================================================

alter type reason_for_attendance add value if not exists 'Just visiting';
