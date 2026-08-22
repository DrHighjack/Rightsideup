DROP INDEX IF EXISTS "invoices_qboInvoiceId_idx";

CREATE UNIQUE INDEX "invoices_qboInvoiceId_key" ON "invoices"("qboInvoiceId");