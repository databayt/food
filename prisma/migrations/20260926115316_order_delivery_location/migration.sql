-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryAccuracy" INTEGER,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3);
