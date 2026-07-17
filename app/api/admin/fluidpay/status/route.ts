import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFluidPayBaseUrl } from "@/lib/fluidpay";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/fluidpay/status
 * Admin-only readiness check for the FluidPay integration. Reports which
 * env vars are present (never their values) so you can confirm the Vercel
 * environment is wired up without digging through dashboards.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKeyConfigured = Boolean(process.env.FLUIDPAY_API_KEY);
  const publicKeyConfigured = Boolean(process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY);
  const webhookSecretConfigured = Boolean(process.env.FLUIDPAY_WEBHOOK_SECRET);

  const ready = apiKeyConfigured && publicKeyConfigured;

  return NextResponse.json({
    ready,
    baseUrl: getFluidPayBaseUrl(),
    checks: {
      FLUIDPAY_API_KEY: apiKeyConfigured,
      NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY: publicKeyConfigured,
      FLUIDPAY_WEBHOOK_SECRET: webhookSecretConfigured,
    },
    notes: [
      ...(ready ? [] : ["Payments are disabled until FLUIDPAY_API_KEY and NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY are both set."]),
      ...(publicKeyConfigured
        ? []
        : ["NEXT_PUBLIC_* vars are baked in at build time — after adding or renaming it in Vercel, redeploy for it to take effect."]),
      ...(webhookSecretConfigured
        ? []
        : ["Webhook signature verification is off until FLUIDPAY_WEBHOOK_SECRET is set (webhooks still work, just unverified)."]),
    ],
  });
}
