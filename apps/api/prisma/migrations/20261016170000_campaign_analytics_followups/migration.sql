-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "aiReport" JSONB,
ADD COLUMN     "aiReportAt" TIMESTAMP(3),
ADD COLUMN     "followUpSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parentCampaignId" TEXT;

-- AlterTable
ALTER TABLE "CampaignContact" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Campaign_parentCampaignId_idx" ON "Campaign"("parentCampaignId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
