CREATE OR REPLACE FUNCTION reject_capability_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CapabilityEvent history is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CapabilityEvent_reject_update" ON "CapabilityEvent";
CREATE TRIGGER "CapabilityEvent_reject_update"
BEFORE UPDATE ON "CapabilityEvent"
FOR EACH ROW EXECUTE FUNCTION reject_capability_event_mutation();
