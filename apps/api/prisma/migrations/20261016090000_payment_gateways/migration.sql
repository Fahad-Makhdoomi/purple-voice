-- AlterEnum
ALTER TYPE "BillingProvider" ADD VALUE 'RAZORPAY';
ALTER TYPE "BillingProvider" ADD VALUE 'PAYPAL';

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'RAZORPAY', 'PAYPAL');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "paypalPlanId" TEXT,
ADD COLUMN     "razorpayPlanId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "paypalSubscriptionId" TEXT,
ADD COLUMN     "razorpaySubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "gateway" "PaymentGateway" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'test',
    "publicId" TEXT,
    "secretEnc" TEXT NOT NULL,
    "webhookSecretEnc" TEXT,
    "webhookId" TEXT,
    "last4" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("gateway")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paypalSubscriptionId_key" ON "Subscription"("paypalSubscriptionId");
