-- Standalone calendar: bookings made by agents, the dashboard or the API live here; Google sync is optional.
ALTER TABLE "Appointment" ADD COLUMN "title" TEXT, ADD COLUMN "location" TEXT, ADD COLUMN "source" TEXT NOT NULL DEFAULT 'AI';

CREATE TABLE "CalendarSettings" (
  "workspaceId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "workingHours" JSONB NOT NULL,
  "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
  "slotStepMin" INTEGER NOT NULL DEFAULT 30,
  "bufferMin" INTEGER NOT NULL DEFAULT 0,
  "minNoticeMin" INTEGER NOT NULL DEFAULT 60,
  "maxDaysAhead" INTEGER NOT NULL DEFAULT 60,
  "googleSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
  "googleIntegrationId" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSettings_pkey" PRIMARY KEY ("workspaceId")
);

CREATE TABLE "CalendarBlock" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Busy',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "externalEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarBlock_workspaceId_source_externalEventId_key" ON "CalendarBlock"("workspaceId", "source", "externalEventId");
CREATE INDEX "CalendarBlock_workspaceId_startsAt_idx" ON "CalendarBlock"("workspaceId", "startsAt");

ALTER TABLE "CalendarSettings" ADD CONSTRAINT "CalendarSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
