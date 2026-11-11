-- The Free plan is now a 7-day trial (was 30 days), then $5 a month.
-- New workspaces get 7 days from sign-up. Trials already running end 7 days
-- after sign-up, but never sooner than 3 days from this release, so nobody
-- loses access without notice. Workspaces whose trial already ended are unchanged.
ALTER TABLE "Workspace" ALTER COLUMN "trialEndsAt" SET DEFAULT (now() + '7 days'::interval);

UPDATE "Workspace" SET "trialEndsAt" = GREATEST("createdAt" + interval '7 days', now() + interval '3 days')
WHERE "trialEndsAt" > now()
  AND "trialEndsAt" > GREATEST("createdAt" + interval '7 days', now() + interval '3 days');

UPDATE "Plan" SET
  "tagline" = 'Free for 7 days, then $5 a month.',
  "highlights" = array_replace("highlights", 'Free for your first month, then $5 a month', '7-day free trial, then $5 a month')
WHERE "code" = 'FREE';
