import { createHash, randomBytes } from "crypto";
import { chargeVaultRecord } from "@/lib/fluidpay";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const SMART_SIGN_MONTHLY_PRICE_CENTS = 2900;
export const SMART_SIGN_BUYOUT_PRICE_CENTS = 9900;
export const SMART_SIGN_TRIAL_DAYS = 90;
export const SMART_SIGN_REMINDER_DAY = 75;

export function getSmartSignUrl(tagCode: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com";
  return `${appUrl}/s/${tagCode}`;
}

export function createSmartSignTagCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

export function addMonths(from: Date, months: number) {
  const result = new Date(from);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export async function ensureSmartSignTrial(agentId: string, now = new Date()) {
  const trialEndsAt = new Date(now);
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + SMART_SIGN_TRIAL_DAYS);

  return prisma.smartSignSubscription.upsert({
    where: { agentId },
    update: {},
    create: {
      agentId,
      trialStartedAt: now,
      trialEndsAt,
      monthlyPriceCents: SMART_SIGN_MONTHLY_PRICE_CENTS,
    },
  });
}

async function resolveSavedPaymentMethod(agentId: string, paymentMethodId: string) {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { vaultId: true, paymentCardLast4: true },
  });
  if (!agent) return null;

  if (paymentMethodId === `legacy:${agentId}` && agent.vaultId) {
    return { fluidpayPaymentMethodId: agent.vaultId, last4: agent.paymentCardLast4 };
  }

  return prisma.savedPaymentMethod.findFirst({
    where: { id: paymentMethodId, userId: agentId },
    select: { fluidpayPaymentMethodId: true, last4: true },
  });
}

export async function getSmartSignAgentDashboard(agentId: string) {
  const subscription = await prisma.smartSignSubscription.findUnique({ where: { agentId } });
  const tags = await prisma.smartSignTag.findMany({
    where: { sign: { assignedToUserId: agentId } },
    include: {
      sign: {
        select: {
          id: true,
          signNumber: true,
          status: true,
          deployedAddress: true,
          assignedToOrder: { select: { id: true, address: true, photos: true } },
        },
      },
      _count: { select: { tapEvents: true } },
      tapEvents: { orderBy: { tappedAt: "desc" }, take: 1, select: { tappedAt: true } },
    },
    orderBy: { installedAt: "desc" },
  });

  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
  const tagIds = tags.map((tag) => tag.id);

  const [totalTaps, tapsThisWeek, tapsPreviousWeek, dailyTaps] = await Promise.all([
    prisma.smartSignTapEvent.count({ where: { tagId: { in: tagIds } } }),
    prisma.smartSignTapEvent.count({ where: { tagId: { in: tagIds }, tappedAt: { gte: weekAgo } } }),
    prisma.smartSignTapEvent.count({ where: { tagId: { in: tagIds }, tappedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.smartSignTapEvent.findMany({
      where: { tagId: { in: tagIds }, tappedAt: { gte: weekAgo } },
      select: { tappedAt: true },
      orderBy: { tappedAt: "asc" },
    }),
  ]);

  const trend = tapsPreviousWeek === 0
    ? (tapsThisWeek > 0 ? 100 : 0)
    : Math.round(((tapsThisWeek - tapsPreviousWeek) / tapsPreviousWeek) * 100);
  const dailyMap = new Map<string, number>();
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    dailyMap.set(date.toISOString().slice(0, 10), 0);
  }
  dailyTaps.forEach((tap) => {
    const key = tap.tappedAt.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  });

  return {
    subscription,
    tags: tags.map((tag) => ({
      id: tag.id,
      tagCode: tag.tagCode,
      signNumber: tag.sign.signNumber,
      status: tag.sign.status,
      listingAddress: tag.sign.assignedToOrder?.address || tag.sign.deployedAddress || "No active listing",
      tapCount: tag._count.tapEvents,
      lastTapAt: tag.tapEvents[0]?.tappedAt || null,
      url: getSmartSignUrl(tag.tagCode),
    })),
    summary: { totalTaps, tapsThisWeek, trend },
    dailyTaps: Array.from(dailyMap, ([date, taps]) => ({ date, taps })),
  };
}

export async function getPublicSmartSignContext(tagCode: string) {
  const tag = await prisma.smartSignTag.findUnique({
    where: { tagCode },
    include: {
      sign: {
        include: {
          assignedToUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          assignedToOrder: { select: { id: true, address: true, photos: true, status: true } },
        },
      },
    },
  });
  if (!tag || !tag.isActive || !tag.sign.assignedToUser || !tag.sign.assignedToOrder) return null;

  let subscription = await prisma.smartSignSubscription.findUnique({ where: { agentId: tag.sign.assignedToUser.id } });
  if (!subscription) subscription = await ensureSmartSignTrial(tag.sign.assignedToUser.id);
  const now = new Date();
  const isLive = Boolean(subscription && (
    subscription.status === "ACTIVE" ||
    subscription.status === "BUYOUT" ||
    (subscription.status === "TRIAL" && subscription.trialEndsAt > now)
  ));

  return { tag, subscription, isLive };
}

export async function recordSmartSignTap(input: {
  tagCode: string;
  latitude?: number;
  longitude?: number;
  deviceType?: string;
}) {
  const context = await getPublicSmartSignContext(input.tagCode);
  if (!context?.isLive) return { recorded: false, isLive: false };

  await prisma.smartSignTapEvent.create({
    data: {
      tagId: context.tag.id,
      latitude: input.latitude,
      longitude: input.longitude,
      deviceType: input.deviceType?.slice(0, 30),
    },
  });
  return { recorded: true, isLive: true };
}

function getTopTag(tags: Awaited<ReturnType<typeof getSmartSignAgentDashboard>>["tags"]) {
  return [...tags].sort((left, right) => right.tapCount - left.tapCount)[0];
}

export async function processSmartSignSubscriptions(now = new Date()) {
  const reminderThreshold = new Date(now);
  reminderThreshold.setUTCDate(reminderThreshold.getUTCDate() - SMART_SIGN_REMINDER_DAY);
  const reminders = await prisma.smartSignSubscription.findMany({
    where: { status: "TRIAL", reminderSentAt: null, trialStartedAt: { lte: reminderThreshold } },
    include: { agent: { select: { firstName: true, email: true } } },
  });

  for (const subscription of reminders) {
    const dashboard = await getSmartSignAgentDashboard(subscription.agentId);
    const topTag = getTopTag(dashboard.tags);
    try {
      await sendEmail({
        to: subscription.agent.email,
        subject: "Your Smart Sign trial is getting attention",
        html: `<p>Hi ${subscription.agent.firstName},</p><p>Your Smart Sign trial has recorded <strong>${dashboard.summary.totalTaps} tap${dashboard.summary.totalTaps === 1 ? "" : "s"}</strong>.</p><p>${topTag ? `Your top listing is <strong>${topTag.listingAddress}</strong> with ${topTag.tapCount} taps.` : "Add a tagged post to start tracking engagement."}</p><p>Your 3-month trial ends soon. Add a saved card in your Smart Sign dashboard to continue for $29/month without interruption.</p>`,
      });
      await prisma.smartSignSubscription.update({ where: { id: subscription.id }, data: { reminderSentAt: now } });
    } catch (error) {
      console.error(`[SMART_SIGN] Trial reminder failed for ${subscription.agentId}:`, error);
    }
  }

  const due = await prisma.smartSignSubscription.findMany({
    where: {
      status: { in: ["TRIAL", "ACTIVE"] },
      OR: [
        { status: "TRIAL", trialEndsAt: { lte: now } },
        { status: "ACTIVE", nextBillingAt: { lte: now } },
      ],
    },
  });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const subscription of due) {
    if (!subscription.savedPaymentMethodId) {
      if (subscription.status === "TRIAL") {
        await prisma.smartSignSubscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED", billingFailureReason: "No saved payment method" } });
      }
      results.push({ id: subscription.id, status: "expired", error: "No saved payment method" });
      continue;
    }

    const paymentMethod = await resolveSavedPaymentMethod(subscription.agentId, subscription.savedPaymentMethodId);
    if (!paymentMethod) {
      if (subscription.status === "TRIAL") {
        await prisma.smartSignSubscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED", billingFailureReason: "Saved payment method unavailable" } });
      }
      results.push({ id: subscription.id, status: "failed", error: "Saved payment method unavailable" });
      continue;
    }

    const chargeReference = createHash("sha256").update(`smart-sign:${subscription.id}:${now.toISOString().slice(0, 10)}`).digest("hex").slice(0, 20);
    try {
      const charge = await chargeVaultRecord(subscription.agentId, paymentMethod.fluidpayPaymentMethodId, subscription.monthlyPriceCents, chargeReference);
      await prisma.smartSignSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          nextBillingAt: addMonths(now, 1),
          lastChargedAt: now,
          lastTransactionId: charge.transactionId,
          billingFailureReason: null,
        },
      });
      results.push({ id: subscription.id, status: "charged" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Charge failed";
      await prisma.smartSignSubscription.update({ where: { id: subscription.id }, data: { billingFailureReason: message } });
      results.push({ id: subscription.id, status: "failed", error: message });
    }
  }

  return { reminders: reminders.length, results };
}
