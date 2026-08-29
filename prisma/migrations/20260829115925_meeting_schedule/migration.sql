-- A meeting can now be booked before it happens: it gains a start time and an
-- agenda, and its summary becomes optional because there is nothing to write up
-- until the meeting has taken place.

ALTER TABLE "Meeting" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "description" TEXT;
ALTER TABLE "Meeting" ALTER COLUMN "summary" DROP NOT NULL;
