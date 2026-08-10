-- CreateTable
CREATE TABLE "StoreProduct" (
    "storeProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artworkAssetId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("storeProductId")
);

-- CreateTable
CREATE TABLE "StoreVariant" (
    "storeVariantId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "priceCents" INTEGER NOT NULL,
    "stripePriceReference" TEXT NOT NULL,
    "printfulVariantReference" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StoreVariant_pkey" PRIMARY KEY ("storeVariantId")
);

-- CreateTable
CREATE TABLE "Order" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCheckoutReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "orderLineId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("orderLineId")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "stripeWebhookEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("stripeWebhookEventId")
);

-- CreateTable
CREATE TABLE "OrderPaymentConfirmation" (
    "orderPaymentConfirmationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stripeWebhookEventId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "amountCents" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPaymentConfirmation_pkey" PRIMARY KEY ("orderPaymentConfirmationId")
);

-- CreateTable
CREATE TABLE "PrintfulFulfillmentSubmission" (
    "printfulFulfillmentSubmissionId" TEXT NOT NULL,
    "orderPaymentConfirmationId" TEXT NOT NULL,
    "provider" "FulfillmentProvider" NOT NULL DEFAULT 'PRINTFUL',
    "providerOrderReference" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintfulFulfillmentSubmission_pkey" PRIMARY KEY ("printfulFulfillmentSubmissionId")
);

-- CreateTable
CREATE TABLE "OrderRefund" (
    "orderRefundId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stripeWebhookEventId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "amountCents" INTEGER NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("orderRefundId")
);

-- CreateTable
CREATE TABLE "OrderReturnEligibility" (
    "orderReturnEligibilityId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReturnEligibility_pkey" PRIMARY KEY ("orderReturnEligibilityId")
);

ALTER TABLE "StoreVariant" ADD CONSTRAINT "StoreVariant_configuration_check"
CHECK (
  "priceCents" > 0
  AND length("stripePriceReference") > 0
  AND length("printfulVariantReference") > 0
);

ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_values_check"
CHECK ("quantity" > 0 AND "unitPriceCents" > 0);

ALTER TABLE "StripeWebhookEvent" ADD CONSTRAINT "StripeWebhookEvent_payload_hash_check"
CHECK ("payloadSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "OrderPaymentConfirmation" ADD CONSTRAINT "OrderPaymentConfirmation_amount_check"
CHECK ("amountCents" > 0);

ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_amount_check"
CHECK ("amountCents" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_name_key" ON "StoreProduct"("name");
CREATE INDEX "StoreProduct_artworkAssetId_idx" ON "StoreProduct"("artworkAssetId");
CREATE UNIQUE INDEX "StoreVariant_stripePriceReference_key" ON "StoreVariant"("stripePriceReference");
CREATE UNIQUE INDEX "StoreVariant_printfulVariantReference_key" ON "StoreVariant"("printfulVariantReference");
CREATE INDEX "StoreVariant_storeProductId_idx" ON "StoreVariant"("storeProductId");
CREATE UNIQUE INDEX "Order_stripeCheckoutReference_key" ON "Order"("stripeCheckoutReference");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");
CREATE INDEX "OrderLine_storeVariantId_idx" ON "OrderLine"("storeVariantId");
CREATE UNIQUE INDEX "OrderPaymentConfirmation_orderId_key" ON "OrderPaymentConfirmation"("orderId");
CREATE UNIQUE INDEX "OrderPaymentConfirmation_stripeWebhookEventId_key" ON "OrderPaymentConfirmation"("stripeWebhookEventId");
CREATE UNIQUE INDEX "PrintfulFulfillment_confirmation_key" ON "PrintfulFulfillmentSubmission"("orderPaymentConfirmationId");
CREATE UNIQUE INDEX "PrintfulFulfillment_provider_order_key" ON "PrintfulFulfillmentSubmission"("providerOrderReference");
CREATE UNIQUE INDEX "OrderRefund_stripeWebhookEventId_key" ON "OrderRefund"("stripeWebhookEventId");
CREATE INDEX "OrderRefund_orderId_refundedAt_idx" ON "OrderRefund"("orderId", "refundedAt");
CREATE UNIQUE INDEX "OrderReturnEligibility_orderId_key" ON "OrderReturnEligibility"("orderId");

-- AddForeignKey
ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_artworkAssetId_fkey" FOREIGN KEY ("artworkAssetId") REFERENCES "ManagedAsset"("managedAssetId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreVariant" ADD CONSTRAINT "StoreVariant_storeProductId_fkey" FOREIGN KEY ("storeProductId") REFERENCES "StoreProduct"("storeProductId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_storeVariantId_fkey" FOREIGN KEY ("storeVariantId") REFERENCES "StoreVariant"("storeVariantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPaymentConfirmation" ADD CONSTRAINT "OrderPaymentConfirmation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPaymentConfirmation" ADD CONSTRAINT "OrderPaymentConfirmation_stripeWebhookEventId_fkey" FOREIGN KEY ("stripeWebhookEventId") REFERENCES "StripeWebhookEvent"("stripeWebhookEventId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintfulFulfillmentSubmission" ADD CONSTRAINT "PrintfulFulfillment_confirmation_fkey" FOREIGN KEY ("orderPaymentConfirmationId") REFERENCES "OrderPaymentConfirmation"("orderPaymentConfirmationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_stripeWebhookEventId_fkey" FOREIGN KEY ("stripeWebhookEventId") REFERENCES "StripeWebhookEvent"("stripeWebhookEventId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderReturnEligibility" ADD CONSTRAINT "OrderReturnEligibility_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_order_line_price()
RETURNS trigger AS $$
DECLARE
  configured_price INTEGER;
  configured_available BOOLEAN;
BEGIN
  SELECT "priceCents", "available" INTO configured_price, configured_available
  FROM "StoreVariant"
  WHERE "storeVariantId" = NEW."storeVariantId";
  IF NOT FOUND OR NOT configured_available OR NEW."unitPriceCents" <> configured_price THEN
    RAISE EXCEPTION 'OrderLine must use an available server-authoritative variant price';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderLine_validate_price"
BEFORE INSERT ON "OrderLine"
FOR EACH ROW EXECUTE FUNCTION validate_order_line_price();

CREATE OR REPLACE FUNCTION validate_order_refund()
RETURNS trigger AS $$
DECLARE
  paid_amount INTEGER;
  refunded_before INTEGER;
BEGIN
  SELECT "amountCents" INTO paid_amount
  FROM "OrderPaymentConfirmation"
  WHERE "orderId" = NEW."orderId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order refund requires confirmed Stripe payment';
  END IF;
  SELECT COALESCE(sum("amountCents"), 0) INTO refunded_before
  FROM "OrderRefund" WHERE "orderId" = NEW."orderId";
  IF refunded_before + NEW."amountCents" > paid_amount THEN
    RAISE EXCEPTION 'Order refunds exceed confirmed payment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderRefund_validate"
BEFORE INSERT ON "OrderRefund"
FOR EACH ROW EXECUTE FUNCTION validate_order_refund();

CREATE OR REPLACE FUNCTION reject_commerce_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Commerce event history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_reject_update" BEFORE UPDATE OR DELETE ON "Order" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "OrderLine_reject_update" BEFORE UPDATE OR DELETE ON "OrderLine" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "StripeWebhookEvent_reject_update" BEFORE UPDATE OR DELETE ON "StripeWebhookEvent" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "OrderPaymentConfirmation_reject_update" BEFORE UPDATE OR DELETE ON "OrderPaymentConfirmation" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "PrintfulFulfillmentSubmission_reject_update" BEFORE UPDATE OR DELETE ON "PrintfulFulfillmentSubmission" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "OrderRefund_reject_update" BEFORE UPDATE OR DELETE ON "OrderRefund" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
CREATE TRIGGER "OrderReturnEligibility_reject_update" BEFORE UPDATE OR DELETE ON "OrderReturnEligibility" FOR EACH ROW EXECUTE FUNCTION reject_commerce_event_mutation();
