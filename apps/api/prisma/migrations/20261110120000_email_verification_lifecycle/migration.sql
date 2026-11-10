-- Email verification and lifecycle (onboarding and upgrade) emails.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailUnsubscribedAt" TIMESTAMP(3);

-- Accounts that exist today keep working: treat them as verified.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- The upgrade sequence follows the welcome email, so accounts that exist today (which
-- never got one) are not sent a burst of old onboarding emails.

CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "next" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LifecycleEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifecycleEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LifecycleEmail_userId_step_key" ON "LifecycleEmail"("userId", "step");
CREATE INDEX "LifecycleEmail_step_sentAt_idx" ON "LifecycleEmail"("step", "sentAt");
ALTER TABLE "LifecycleEmail" ADD CONSTRAINT "LifecycleEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Platform email comes from hello@purplerocket.co. Only a sender still on the old
-- placeholder domain is changed; a sender a super admin chose stays as it is.
UPDATE "SiteSetting"
SET "value" = jsonb_set("value"::jsonb, '{from}', '"Purple Voice <hello@purplerocket.co>"'::jsonb)
WHERE "key" = 'email' AND ("value"::jsonb ->> 'from') ILIKE '%purplevoice.ai%';
