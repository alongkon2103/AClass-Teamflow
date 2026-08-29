-- A meeting can now be booked before it happens: it gains a start time and an
-- agenda, and its summary becomes optional because there is nothing to write up
-- until the meeting has taken place.
--
-- Written to be safe to re-run: a deploy hit this file with the columns already
-- present and aborted part way, so re-running has to be able to finish the job
-- rather than fail on the first statement.

ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Meeting" ALTER COLUMN "summary" DROP NOT NULL;
