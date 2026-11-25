-- DropIndex
DROP INDEX "email_job_logs_jobId_idx";

-- DropIndex
DROP INDEX "email_jobs_userId_idx";

-- AlterTable
ALTER TABLE "email_jobs" ADD COLUMN     "bullRepeatJobKey" TEXT,
ADD COLUMN     "delayMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "senderEmail" TEXT,
ADD COLUMN     "senderId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slackAccessToken" TEXT,
ADD COLUMN     "slackChannelId" TEXT,
ADD COLUMN     "slackNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slackTeamName" TEXT;

-- CreateTable
CREATE TABLE "sender_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 50,
    "minDelayMs" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sender_accounts_userId_isActive_idx" ON "sender_accounts"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sender_accounts_userId_email_key" ON "sender_accounts"("userId", "email");

-- CreateIndex
CREATE INDEX "email_job_logs_jobId_timestamp_idx" ON "email_job_logs"("jobId", "timestamp");

-- CreateIndex
CREATE INDEX "email_jobs_userId_status_idx" ON "email_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "email_jobs_userId_scheduledFor_idx" ON "email_jobs"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "email_jobs_senderId_status_idx" ON "email_jobs"("senderId", "status");

-- CreateIndex
CREATE INDEX "email_jobs_createdAt_idx" ON "email_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_jobs_userId_idempotencyKey_key" ON "email_jobs"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "sender_accounts" ADD CONSTRAINT "sender_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "sender_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

