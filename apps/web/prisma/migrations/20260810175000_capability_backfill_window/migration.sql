-- Permit only the following owner-correction migration to translate legacy
-- numeric COUNTER payloads. The append-only trigger is restored immediately by
-- 20260810185000_capability_append_only_restore.
DROP TRIGGER IF EXISTS "CapabilityEvent_reject_update" ON "CapabilityEvent";
