-- Meeting minutes, and the day a task was actually delivered.
--
-- completedAt is backfilled for tasks already marked DONE so the calendar has
-- something to compare against. updatedAt is the closest signal available, and
-- it is only a starting point: a task edited after completion would look later
-- than it was, so anything that lands after its due date is left NULL rather
-- than being reported as a late delivery it may not have been.

ALTER TABLE "Task" ADD COLUMN "completedAt" DATE;

UPDATE "Task"
  SET "completedAt" = "updatedAt"::date
  WHERE "status" = 'DONE'
    AND ("dueDate" IS NULL OR "updatedAt"::date <= "dueDate");

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingAt" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Meeting_meetingAt_idx" ON "Meeting"("meetingAt");

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
