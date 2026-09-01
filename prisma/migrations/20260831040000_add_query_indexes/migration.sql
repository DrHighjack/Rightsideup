CREATE INDEX "invoices_paidAt_idx" ON "invoices"("paidAt");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "tickets_811_status_createdAt_idx" ON "tickets_811"("status", "createdAt");
