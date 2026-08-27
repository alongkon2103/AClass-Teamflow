-- Multiple assignees per task, leader replies on progress, free-text game name,
-- and a "resolved" state for feedback.
--
-- Task.assigneeId is replaced by a join table. The existing assignment is copied
-- across BEFORE the column is dropped, so no current allocation is lost.

-- 1. New enum values ---------------------------------------------------------
ALTER TYPE "FeedbackStatus" ADD VALUE 'RESOLVED' AFTER 'FIXING';
ALTER TYPE "NotificationType" ADD VALUE 'PROGRESS_REPLIED';

-- 2. Task gains a free-text game name ----------------------------------------
ALTER TABLE "Task" ADD COLUMN "gameNote" TEXT;

-- 3. Join table for assignees ------------------------------------------------
CREATE TABLE "TaskAssignment" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("taskId","userId")
);

CREATE INDEX "TaskAssignment_userId_idx" ON "TaskAssignment"("userId");

ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Carry every existing assignment over, then retire the column ------------
INSERT INTO "TaskAssignment" ("taskId", "userId", "assignedAt")
SELECT "id", "assigneeId", COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "Task"
WHERE "assigneeId" IS NOT NULL;

DROP INDEX IF EXISTS "Task_assigneeId_status_idx";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assigneeId_fkey";
ALTER TABLE "Task" DROP COLUMN "assigneeId";

CREATE INDEX "Task_status_idx" ON "Task"("status");

-- 5. Replies on a progress entry ---------------------------------------------
CREATE TABLE "ProgressComment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressComment_entryId_idx" ON "ProgressComment"("entryId");

ALTER TABLE "ProgressComment" ADD CONSTRAINT "ProgressComment_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "ProgressEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressComment" ADD CONSTRAINT "ProgressComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
