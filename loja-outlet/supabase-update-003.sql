-- Atualização 003 (para quem JÁ rodou o schema + updates 001 e 002): estrutura de pagamentos.
-- Rode UMA vez no SQL Editor do Supabase. Não apaga nem altera dados existentes.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "installmentCents" INTEGER,
ADD COLUMN     "installments" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "pixCopyPaste" TEXT,
ADD COLUMN     "pixQrCode" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

