-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'UNAVAILABLE';

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "device" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "mobileImagePath" TEXT,
ADD COLUMN     "mobileImageUrl" TEXT;
