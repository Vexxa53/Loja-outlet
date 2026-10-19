-- Atualização 001 (para quem JÁ rodou supabase-schema.sql antes de 19/10/2026): status 'Indisponível' e banners com imagem mobile.
-- Rode UMA vez no SQL Editor do Supabase.
-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'UNAVAILABLE';

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "device" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "mobileImagePath" TEXT,
ADD COLUMN     "mobileImageUrl" TEXT;
