-- The Free plan is a 30-day trial, then $5 a month. Every workspace gets a trial
-- end date: existing ones get 30 days from this release, new ones 30 days from sign-up.
ALTER TABLE "Workspace" ADD COLUMN "trialEndsAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '30 days'::interval);

UPDATE "Plan" SET
  "priceMonthlyCents" = 500,
  "tagline" = 'Free for your first month, then $5 a month.',
  "highlights" = ARRAY['One AI call agent', 'Connect one phone number', '1 calling campaign', '100 AI call minutes a month', 'Appointment booking and call summaries', 'One app integration', 'Free for your first month, then $5 a month']
WHERE "code" = 'FREE';
