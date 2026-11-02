-- Pay-then-place: a MoMo order waits for the guest's PIN before staff see it.
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT' BEFORE 'NEW';

-- When staff first see an order. Every existing order was visible from creation.
ALTER TABLE "orders" ADD COLUMN "placedAt" TIMESTAMP(3);
UPDATE "orders" SET "placedAt" = "createdAt";

-- Counter (POS) walk-ins: no phone, no customer row.
ALTER TABLE "orders" ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "customerPhone" DROP NOT NULL;
