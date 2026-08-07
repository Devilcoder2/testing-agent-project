UPDATE "RecordedStep"
SET "target" = jsonb_set("target", '{text}', '"[REDACTED]"'::jsonb)
WHERE "target"->>'name' = 'password'
  AND "target"->>'text' IS DISTINCT FROM '[REDACTED]';

UPDATE "TestStep"
SET "target" = jsonb_set("target", '{text}', '"[REDACTED]"'::jsonb)
WHERE "target"->>'name' = 'password'
  AND "target"->>'text' IS DISTINCT FROM '[REDACTED]';
