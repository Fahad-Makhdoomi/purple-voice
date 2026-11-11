-- The Free plan is now called Starter (its code stays FREE). Only rows still
-- carrying the old built-in wording change, so admin edits are kept.
UPDATE "Plan" SET "name" = 'Starter' WHERE "code" = 'FREE' AND "name" = 'Free';
UPDATE "Plan" SET "tagline" = 'Try it free for 7 days, then $5 a month.'
WHERE "code" = 'FREE' AND "tagline" IN ('Free for 7 days, then $5 a month.', 'Free for your first month, then $5 a month.');

-- Home page hero: the shorter subtitle and a call to action that names the trial.
UPDATE "SiteSetting" SET "value" = jsonb_set("value"::jsonb, '{hero,subtitle}',
  to_jsonb('AI voice agents that call your leads in minutes, answer their questions and book meetings straight into your calendar. On your own phone numbers, around the clock.'::text))
WHERE "key" = 'content'
  AND "value"::jsonb #>> '{hero,subtitle}' = 'Purple Voice builds AI agents that phone your leads, answer their questions and put appointments straight into your calendar — on your own phone numbers, around the clock.';

UPDATE "SiteSetting" SET "value" = jsonb_set("value"::jsonb, '{hero,primaryLabel}', '"Start free trial"'::jsonb)
WHERE "key" = 'content' AND "value"::jsonb #>> '{hero,primaryLabel}' = 'Start free';
