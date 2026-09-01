import { createHash, randomBytes } from "crypto";
import { chargeVaultRecord } from "@/lib/fluidpay";
import { prisma } from "@/lib/prisma";
import { getSmartSignTrialReminderEmail, sendEmail } from "@/lib/email";

function hashIpValue(value: string) {
  const salt = process.env.SMART_SIGN_TAP_SALT || "northshore-smart-sign";
  return createHash("sha256").update(`${salt}:${value.trim()}`).digest("hex");
}

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

function safePublicUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getOrderListingUrl(order: { rfidListingUrl?: string | null; notes?: string | null }) {
  const savedUrl = safePublicUrl(order.rfidListingUrl);
  if (savedUrl) return savedUrl;

  const legacyMatch = order.notes?.match(/^RFID listing website:\s*(\S+)$/im);
  return safePublicUrl(legacyMatch?.[1]);
}

export function addMonths(from: Date, months: number) {
  const result = new Date(from);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export async function getPublicTapMortgageCta() {
  const enabledSetting = await prisma.appSettings.findUnique({ where: { key: "publicTap.raticanMortgageCtaEnabled" } });
  const urlSetting = await prisma.appSettings.findUnique({ where: { key: "publicTap.raticanMortgageCtaUrl" } });
  const enabled = enabledSetting ? String(enabledSetting.value).toLowerCase() === "true" : false;
  const url = urlSetting && urlSetting.value ? String(urlSetting.value) : "https://raticanmortgage.com/";
  return { enabled, url };
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
          assignedToOrder: { select: { id: true, address: true, photos: true, rfidListingUrl: true, notes: true } },
        },
      },
      _count: {
        select: {
          tapEvents: { where: { OR: [{ agentId }, { agentId: null }] } },
        },
      },
      tapEvents: {
        where: { OR: [{ agentId }, { agentId: null }] },
        orderBy: { tappedAt: "desc" },
        take: 1,
        select: { tappedAt: true },
      },
    },
    orderBy: { installedAt: "desc" },
  });

  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
  const attributedTapWhere = {
    OR: [
      { agentId },
      { agentId: null, tag: { sign: { assignedToUserId: agentId } } },
    ],
  };

  const [totalTaps, tapsThisWeek, tapsPreviousWeek, dailyTaps, listingEvents] = await Promise.all([
    prisma.smartSignTapEvent.count({ where: attributedTapWhere }),
    prisma.smartSignTapEvent.count({ where: { AND: [attributedTapWhere, { tappedAt: { gte: weekAgo } }] } }),
    prisma.smartSignTapEvent.count({ where: { AND: [attributedTapWhere, { tappedAt: { gte: twoWeeksAgo, lt: weekAgo } }] } }),
    prisma.smartSignTapEvent.findMany({
      where: { AND: [attributedTapWhere, { tappedAt: { gte: weekAgo } }] },
      select: { tappedAt: true },
      orderBy: { tappedAt: "asc" },
    }),
    prisma.smartSignTapEvent.findMany({
      where: { agentId },
      select: { orderId: true, listingAddress: true, listingUrl: true, tappedAt: true },
      orderBy: { tappedAt: "desc" },
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
  const listingMap = new Map<string, { orderId: string | null; address: string; listingUrl: string | null; taps: number; lastTapAt: Date }>();
  listingEvents.forEach((tap) => {
    const key = tap.orderId || tap.listingAddress || "unknown";
    const existing = listingMap.get(key);
    if (existing) {
      existing.taps += 1;
      return;
    }
    listingMap.set(key, {
      orderId: tap.orderId,
      address: tap.listingAddress || "Unknown listing",
      listingUrl: tap.listingUrl,
      taps: 1,
      lastTapAt: tap.tappedAt,
    });
  });

  return {
    subscription,
    tags: tags.map((tag) => ({
      id: tag.id,
      tagCode: tag.tagCode,
      signNumber: tag.sign.signNumber,
      status: tag.sign.status,
      listingAddress: tag.sign.assignedToOrder?.address || tag.sign.deployedAddress || "No active listing",
      listingUrl: tag.sign.assignedToOrder ? getOrderListingUrl(tag.sign.assignedToOrder) : null,
      tapCount: tag._count.tapEvents,
      lastTapAt: tag.tapEvents[0]?.tappedAt || null,
      url: getSmartSignUrl(tag.tagCode),
    })),
    summary: { totalTaps, tapsThisWeek, trend },
    dailyTaps: Array.from(dailyMap, ([date, taps]) => ({ date, taps })),
    listingBreakdown: Array.from(listingMap.values()).sort((left, right) => right.taps - left.taps),
  };
}

export async function getPublicSmartSignContext(tagCode: string) {
  const tag = await prisma.smartSignTag.findUnique({
    where: { tagCode },
    include: {
      sign: {
        include: {
          assignedToUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          assignedToOrder: { select: { id: true, address: true, photos: true, status: true, rfidListingUrl: true, notes: true } },
        },
      },
    },
  });
  if (!tag) return null;

  const sign = tag.sign;
  const hasActiveListing = Boolean(tag.isActive && sign.assignedToUser && sign.assignedToOrder);
  let subscription = null as Awaited<ReturnType<typeof prisma.smartSignSubscription.findUnique>> | null;
  if (sign.assignedToUser) {
    subscription = await prisma.smartSignSubscription.findUnique({ where: { agentId: sign.assignedToUser.id } });
    if (!subscription) subscription = await ensureSmartSignTrial(sign.assignedToUser.id);
  }

  const now = new Date();
  const isLive = Boolean(subscription && hasActiveListing && (
    subscription.status === "ACTIVE" ||
    subscription.status === "BUYOUT" ||
    (subscription.status === "TRIAL" && subscription.trialEndsAt > now)
  ));

  return {
    tag,
    sign,
    subscription,
    isLive,
    hasActiveListing,
    listingUrl: sign.assignedToOrder ? getOrderListingUrl(sign.assignedToOrder) : null,
  };
}

export async function getPublicSmartSignContextBySignId(signId: string) {
  const sign = await prisma.sign.findFirst({
    where: { OR: [{ signNumber: signId }, { id: signId }] },
    include: {
      smartSignTag: {
        include: {
          sign: {
            include: {
              assignedToUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
              assignedToOrder: { select: { id: true, address: true, photos: true, status: true, rfidListingUrl: true, notes: true } },
            },
          },
        },
      },
      assignedToUser: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      assignedToOrder: { select: { id: true, address: true, photos: true, status: true, rfidListingUrl: true, notes: true } },
    },
  });

  if (!sign) return null;

  const tag = sign.smartSignTag ?? null;
  const hasActiveListing = Boolean(tag?.isActive && sign.assignedToUser && sign.assignedToOrder);
  let subscription = null as Awaited<ReturnType<typeof prisma.smartSignSubscription.findUnique>> | null;
  if (sign.assignedToUser) {
    subscription = await prisma.smartSignSubscription.findUnique({ where: { agentId: sign.assignedToUser.id } });
    if (!subscription) subscription = await ensureSmartSignTrial(sign.assignedToUser.id);
  }

  const now = new Date();
  const isLive = Boolean(subscription && hasActiveListing && (
    subscription.status === "ACTIVE" ||
    subscription.status === "BUYOUT" ||
    (subscription.status === "TRIAL" && subscription.trialEndsAt > now)
  ));

  return {
    tag,
    sign,
    subscription,
    isLive,
    hasActiveListing,
    listingUrl: sign.assignedToOrder ? getOrderListingUrl(sign.assignedToOrder) : null,
  };
}

export async function recordSmartSignTap(input: {
  tagCode?: string;
  signId?: string;
  latitude?: number;
  longitude?: number;
  deviceType?: string;
  userAgent?: string;
  referrer?: string;
  ip?: string;
}) {
  const tag = input.tagCode
    ? await prisma.smartSignTag.findUnique({
        where: { tagCode: input.tagCode },
        include: { sign: { include: { assignedToUser: true, assignedToOrder: true } } },
      })
    : input.signId
      ? await prisma.smartSignTag.findFirst({
          where: {
            sign: {
              OR: [{ signNumber: input.signId }, { id: input.signId }],
            },
          },
          include: { sign: { include: { assignedToUser: true, assignedToOrder: true } } },
        })
      : null;

  if (!tag) {
    const sign = input.signId
      ? await prisma.sign.findFirst({
          where: { OR: [{ signNumber: input.signId }, { id: input.signId }] },
          include: { assignedToUser: true, assignedToOrder: true },
        })
      : null;
    if (!sign) return { recorded: false, isLive: false };

    const tagRecord = await prisma.smartSignTag.findFirst({ where: { signId: sign.id } }) ?? await (async () => {
      let tagCode = createSmartSignTagCode();
      while (await prisma.smartSignTag.findUnique({ where: { tagCode }, select: { id: true } })) {
        tagCode = createSmartSignTagCode();
      }
      return prisma.smartSignTag.create({
        data: { signId: sign.id, tagCode },
      });
    })();

    await prisma.smartSignTapEvent.create({
      data: {
        tagId: tagRecord.id,
        orderId: sign.assignedToOrder?.id || null,
        agentId: sign.assignedToUser?.id || null,
        listingAddress: sign.assignedToOrder?.address || sign.deployedAddress || null,
        listingUrl: sign.assignedToOrder ? getOrderListingUrl(sign.assignedToOrder) : null,
        latitude: input.latitude,
        longitude: input.longitude,
        deviceType: input.deviceType?.slice(0, 30),
        userAgent: input.userAgent?.slice(0, 500) || null,
        referrer: input.referrer?.slice(0, 500) || null,
        ipHash: input.ip ? hashIpValue(input.ip) : null,
      },
    });
    return { recorded: true, isLive: false };
  }

  if (!tag.isActive) return { recorded: false, isLive: false };

  const context = await getPublicSmartSignContext(tag.tagCode);
  const isLive = Boolean(context?.isLive);

  await prisma.smartSignTapEvent.create({
    data: {
      tagId: tag.id,
      orderId: context?.sign.assignedToOrder?.id || null,
      agentId: context?.sign.assignedToUser?.id || null,
      listingAddress: context?.sign.assignedToOrder?.address || context?.sign.deployedAddress || null,
      listingUrl: context?.listingUrl || null,
      latitude: input.latitude,
      longitude: input.longitude,
      deviceType: input.deviceType?.slice(0, 30),
      userAgent: input.userAgent?.slice(0, 500) || null,
      referrer: input.referrer?.slice(0, 500) || null,
      ipHash: input.ip ? hashIpValue(input.ip) : null,
    },
  });
  return { recorded: true, isLive };
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
      const email = getSmartSignTrialReminderEmail({
        firstName: subscription.agent.firstName,
        totalTaps: dashboard.summary.totalTaps,
        topListing: topTag ? { address: topTag.listingAddress, tapCount: topTag.tapCount } : undefined,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.northshoresignco.com"}/dashboard/smart-signs`,
      });
      await sendEmail({
        to: subscription.agent.email,
        subject: email.subject,
        html: email.html,
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
