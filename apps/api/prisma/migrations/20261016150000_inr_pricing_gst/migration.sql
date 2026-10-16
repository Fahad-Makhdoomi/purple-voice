-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "priceMonthlyInrPaise" INTEGER,
ADD COLUMN     "razorpayPlanAmountPaise" INTEGER;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "gstin" TEXT;
