-- ============================================================
-- TELECAL — MIGRATION: Add Doctor Earnings & Payouts System
-- ============================================================

-- Add new WalletTransactionType values
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'EARNINGS_CREDIT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'PAYOUT';

-- Add new NotificationType values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EARNINGS_CREDITED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYOUT_PROCESSED';

-- Add new AuditAction values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EARNINGS_CREDITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_INITIATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYOUT_FAILED';

-- CreateEnum: EarningStatus
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'CREDITED', 'REVERSED');

-- CreateEnum: PayoutStatus
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable: doctor_earnings
CREATE TABLE "doctor_earnings" (
    "id"                TEXT NOT NULL,
    "doctorProfileId"   TEXT NOT NULL,
    "appointmentId"     TEXT NOT NULL,
    "grossAmountKobo"   INTEGER NOT NULL,
    "doctorShareKobo"   INTEGER NOT NULL,
    "platformShareKobo" INTEGER NOT NULL,
    "commissionPercent" INTEGER NOT NULL,
    "status"            "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "creditedAt"        TIMESTAMP(3),
    "reversedAt"        TIMESTAMP(3),
    "reversedBy"        TEXT,
    "reverseReason"     TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: doctor_bank_accounts
CREATE TABLE "doctor_bank_accounts" (
    "id"                     TEXT NOT NULL,
    "doctorProfileId"        TEXT NOT NULL,
    "bankCode"               TEXT NOT NULL,
    "bankName"               TEXT NOT NULL,
    "accountNumber"          TEXT NOT NULL,
    "accountName"            TEXT NOT NULL,
    "paystackRecipientCode"  TEXT,
    "isVerified"             BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: doctor_payouts
CREATE TABLE "doctor_payouts" (
    "id"                 TEXT NOT NULL,
    "doctorProfileId"    TEXT NOT NULL,
    "initiatedBy"        TEXT NOT NULL,
    "amountKobo"         INTEGER NOT NULL,
    "paystackReference"  TEXT,
    "paystackTransferId" TEXT,
    "status"             "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason"      TEXT,
    "periodStart"        TIMESTAMP(3) NOT NULL,
    "periodEnd"          TIMESTAMP(3) NOT NULL,
    "completedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraints
CREATE UNIQUE INDEX "doctor_earnings_appointmentId_key" ON "doctor_earnings"("appointmentId");
CREATE UNIQUE INDEX "doctor_bank_accounts_doctorProfileId_key" ON "doctor_bank_accounts"("doctorProfileId");
CREATE UNIQUE INDEX "doctor_payouts_paystackReference_key" ON "doctor_payouts"("paystackReference");

-- CreateIndex: performance indexes
CREATE INDEX "doctor_earnings_doctorProfileId_createdAt_idx" ON "doctor_earnings"("doctorProfileId", "createdAt" DESC);
CREATE INDEX "doctor_earnings_doctorProfileId_status_idx" ON "doctor_earnings"("doctorProfileId", "status");
CREATE INDEX "doctor_earnings_status_createdAt_idx" ON "doctor_earnings"("status", "createdAt" DESC);
CREATE INDEX "doctor_payouts_doctorProfileId_createdAt_idx" ON "doctor_payouts"("doctorProfileId", "createdAt" DESC);
CREATE INDEX "doctor_payouts_status_idx" ON "doctor_payouts"("status");

-- AddForeignKey: doctor_earnings → doctor_profiles
ALTER TABLE "doctor_earnings"
    ADD CONSTRAINT "doctor_earnings_doctorProfileId_fkey"
    FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: doctor_earnings → appointments
ALTER TABLE "doctor_earnings"
    ADD CONSTRAINT "doctor_earnings_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: doctor_bank_accounts → doctor_profiles
ALTER TABLE "doctor_bank_accounts"
    ADD CONSTRAINT "doctor_bank_accounts_doctorProfileId_fkey"
    FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: doctor_payouts → doctor_profiles
ALTER TABLE "doctor_payouts"
    ADD CONSTRAINT "doctor_payouts_doctorProfileId_fkey"
    FOREIGN KEY ("doctorProfileId") REFERENCES "doctor_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
